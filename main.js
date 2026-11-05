// Runs in the page's own JavaScript world so it can read framework internals,
// server template annotations and build-tool source hints, and freeze requestAnimationFrame.
(() => {
  if (window.__pinpointMain) return;
  window.__pinpointMain = true;
  const w = window, d = document;

  // ---------- Animation freeze (JS-driven animations) ----------
  const rawRAF = w.requestAnimationFrame.bind(w);
  const rawCancel = w.cancelAnimationFrame.bind(w);
  let frozen = false, held = new Map(), fakeId = 1e9;
  w.requestAnimationFrame = function (cb) {
    if (!frozen) return rawRAF(cb);
    const id = ++fakeId; held.set(id, cb); return id;
  };
  w.cancelAnimationFrame = function (id) { if (held.has(id)) held.delete(id); else rawCancel(id); };
  d.addEventListener('pinpoint:freeze', (e) => {
    frozen = e.detail === 'on';
    if (!frozen) { const cbs = [...held.values()]; held = new Map(); cbs.forEach((cb) => rawRAF(cb)); }
  });

  // ---------- Helpers ----------
  const PATH_RE = /((?:[\w@.~-]+\/)*[\w@.~-]+\.(?:tsx?|jsx?|mjs|cjs|vue|svelte|astro|marko|html?|erb|haml|slim|twig|php|heex|leex|eex|exs?|jinja2?|j2|njk|liquid|hbs|handlebars|mustache|cshtml|razor|jsp|ftl|pug|jade|ejs|templ|gohtml|tmpl|cfm|py|rb|go))(?::(\d+))?/;

  function shortPath(p) {
    if (!p) return null;
    let s = String(p).replace(/^webpack-internal:\/\/\/(\([^)]*\)\/)?/, '')
      .replace(/^[a-z]+:\/\/[^/]*\//i, '')
      .replace(/\?[^:]*(?=:\d|$)/, '');
    const m = s.match(/(?:^|\/)((?:src|app|pages|components|lib|features|views|routes|templates|resources|layouts|partials|themes|web|frontend|client)\/.*)$/);
    if (m) s = m[1];
    return s.replace(/^\.\//, '');
  }
  const composedParent = (n) => n.parentElement || (n.getRootNode && n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null);
  const dedupePush = (arr, v) => { if (v && arr[arr.length - 1] !== v) arr.push(v); };
  const clip = (s, n = 80) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  // ---------- React (and Preact via compat with React DevTools-style fibers) ----------
  const REACT_NOISE = new Set([
    'InnerLayoutRouter', 'OuterLayoutRouter', 'RedirectBoundary', 'RedirectErrorBoundary',
    'NotFoundBoundary', 'NotFoundErrorBoundary', 'ErrorBoundaryHandler', 'ErrorBoundary',
    'LoadingBoundary', 'ScrollAndFocusHandler', 'InnerScrollAndFocusHandler',
    'RenderFromTemplateContext', 'HTTPAccessFallbackBoundary', 'HTTPAccessFallbackErrorBoundary',
    'HotReload', 'Router', 'AppRouter', 'ServerRoot', 'Root', 'AppContainer', 'ReactDevOverlay',
    'DevRootHTTPAccessFallbackBoundary', 'PathnameContextProviderAdapter', 'Fragment',
    'Suspense', 'StrictMode', 'Profiler', 'SegmentViewNode', 'SegmentStateProvider'
  ]);
  function fiberName(f) {
    const t = f.type;
    if (!t || typeof t === 'string') return null;
    if (typeof t === 'function') return t.displayName || t.name || null;
    if (typeof t === 'object') return t.displayName || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || null;
    return null;
  }
  function fromStack(stack) {
    const text = typeof stack === 'string' ? stack : stack && stack.stack;
    if (!text) return null;
    for (const line of text.split('\n')) {
      if (/node_modules|react-dom|react\.development|jsx-runtime|jsx-dev-runtime|react-stack-top-frame|chunk-[A-Z0-9]{6}/i.test(line)) continue;
      const m = line.match(/((?:https?|webpack-internal|file):\/\/\/?[^\s)]+?):(\d+)(?::\d+)?\)?\s*$/);
      if (m) return `${shortPath(m[1])}:${m[2]}`;
    }
    return null;
  }
  function react(el) {
    let node = el, key = null;
    for (; node; node = composedParent(node)) {
      key = Object.keys(node).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (key) break;
    }
    if (!node) return null;
    const names = [];
    let source = null, approx = null;
    for (let f = node[key], i = 0; f && i < 300; i++, f = f.return) {
      const n = fiberName(f);
      if (n && n.length > 2 && !REACT_NOISE.has(n)) dedupePush(names, n);
      if (!source && f._debugSource && f._debugSource.fileName) source = `${shortPath(f._debugSource.fileName)}:${f._debugSource.lineNumber}`;
      if (!source && !approx && f._debugStack) approx = fromStack(f._debugStack);
    }
    return {
      framework: 'React', components: names.reverse(),
      source: source || approx, sourceVia: source ? 'React debug info' : approx ? 'React debug stack (approximate)' : null
    };
  }

  // ---------- Preact (with preact/debug or devtools, vnodes on DOM) ----------
  function preact(el) {
    // Preact 10 stores the rendered vnode on DOM nodes under a mangled "__v"/"_vnode" key only in some builds.
    let node = el;
    for (; node; node = composedParent(node)) if (node.__v || node._vnode) break;
    if (!node) return null;
    const names = [];
    for (let v = node.__v || node._vnode, i = 0; v && i < 200; i++, v = v.__ || v._parent) {
      const t = v.type;
      if (typeof t === 'function') dedupePush(names, t.displayName || t.name);
    }
    const src = (node.__v || node._vnode).__source;
    return names.length ? { framework: 'Preact', components: names.reverse(), source: src ? `${shortPath(src.fileName)}:${src.lineNumber}` : null, sourceVia: src ? 'Preact debug info' : null } : null;
  }

  // ---------- Vue 2 / 3 ----------
  function vue(el) {
    let node = el;
    for (; node; node = composedParent(node)) if (node.__vueParentComponent || node.__vue__) break;
    if (!node) return null;
    const names = [];
    let file = null;
    if (node.__vueParentComponent) {
      for (let c = node.__vueParentComponent; c; c = c.parent) {
        const t = c.type || {};
        dedupePush(names, t.name || t.__name || (t.__file && t.__file.split('/').pop().replace(/\.vue$/, '')));
        if (!file && t.__file) file = t.__file;
      }
    } else {
      for (let vm = node.__vue__; vm; vm = vm.$parent) {
        const o = vm.$options || {};
        dedupePush(names, o.name || o._componentTag);
        if (!file && o.__file) file = o.__file;
      }
    }
    return { framework: 'Vue', components: names.reverse(), source: shortPath(file), sourceVia: file ? 'Vue component file' : null };
  }

  // ---------- Svelte 3–5 (dev) ----------
  function svelte(el) {
    const names = [];
    let first = null;
    for (let node = el; node; node = composedParent(node)) {
      const meta = node.__svelte_meta;
      if (!meta) continue;
      const loc = meta.loc || {};
      const file = shortPath(loc.file);
      if (!first && file) first = `${file}:${(loc.line || 0) + 1}`;
      if (file) dedupePush(names, file.split('/').pop().replace(/\.svelte$/, ''));
    }
    if (!first && !names.length) return null;
    return { framework: 'Svelte', components: names.reverse(), source: first, sourceVia: 'Svelte debug info' };
  }

  // ---------- Angular (dev has window.ng; prod falls back to host elements) ----------
  function angular(el) {
    const ng = w.ng;
    if (ng && typeof ng.getOwningComponent === 'function') {
      const names = [];
      let node = el;
      for (let guard = 0; node && guard < 40; guard++) {
        let c = null;
        try { c = ng.getComponent(node) || ng.getOwningComponent(node); } catch { c = null; }
        if (!c) break;
        dedupePush(names, c.constructor && c.constructor.name && c.constructor.name.replace(/^_+/, ''));
        let host = null;
        try { host = ng.getHostElement(c); } catch { host = null; }
        node = host && composedParent(host);
      }
      if (names.length) return { framework: 'Angular', components: names.reverse() };
    }
    let n = el;
    for (; n; n = composedParent(n)) if ('__ngContext__' in n) break;
    if (n || d.querySelector('[ng-version]')) return { framework: 'Angular', components: customElementChain(el) };
    if (w.angular && w.angular.element) {
      const scopeEl = el.closest && el.closest('[ng-controller]');
      return { framework: 'AngularJS', components: scopeEl ? [scopeEl.getAttribute('ng-controller')] : [] };
    }
    return null;
  }

  // ---------- Ember ----------
  function ember(el) {
    if (!w.Ember && !w.EmberENV) return null;
    const names = [];
    try {
      const owner = w.Ember && w.Ember.Namespace && w.Ember.Namespace.NAMESPACES && w.Ember.Namespace.NAMESPACES.find((ns) => ns.__container__);
      const registry = owner && owner.__container__.lookup('-view-registry:main');
      for (let n = el; n; n = n.parentElement) {
        const view = registry && n.id && registry[n.id];
        if (view) dedupePush(names, String(view).replace(/^<[^:]*:component:([^:>]+).*$/, '$1'));
      }
    } catch { /* internals vary by version */ }
    return { framework: 'Ember', components: names.reverse() };
  }

  // ---------- Web components (Lit, Stencil, Shoelace, FAST, plain custom elements) ----------
  function customElementChain(el) {
    const out = [];
    for (let n = el; n; n = composedParent(n)) {
      if (!n.localName || !n.localName.includes('-') || n.localName === 'pinpoint-ui') continue;
      let cls = null;
      try { const C = customElements.get(n.localName); cls = C && C.name && C.name.length > 2 ? C.name : null; } catch { cls = null; }
      dedupePush(out, cls ? `${cls} <${n.localName}>` : `<${n.localName}>`);
    }
    return out.reverse();
  }
  function webComponents(el) {
    const chain = customElementChain(el);
    if (!chain.length) return null;
    const fw = (w.litElementVersions || w.litHtmlVersions) ? 'Lit' : w.Stencil || d.querySelector('[s-id]') ? 'Stencil' : 'Web Components';
    return { framework: fw, components: chain };
  }

  // ---------- Build-tool source attributes (work with any framework) ----------
  const ATTR_SOURCES = [
    ['data-insp-path', (n) => n.getAttribute('data-insp-path')],                                   // code-inspector-plugin
    ['data-inspector-relative-path', (n) => `${n.getAttribute('data-inspector-relative-path')}:${n.getAttribute('data-inspector-line') || ''}`], // react-dev-inspector
    ['data-v-inspector', (n) => n.getAttribute('data-v-inspector')],                               // vite-plugin-vue-inspector
    ['data-astro-source-file', (n) => `${n.getAttribute('data-astro-source-file')}:${(n.getAttribute('data-astro-source-loc') || '').split(':')[0]}`], // Astro dev
    ['data-qwik-inspector', (n) => n.getAttribute('data-qwik-inspector')],                         // Qwik dev
    ['data-source-file', (n) => `${n.getAttribute('data-source-file')}${n.getAttribute('data-source-line') ? ':' + n.getAttribute('data-source-line') : ''}`],
    ['data-source', (n) => n.getAttribute('data-source')],
    ['data-sourcepos', (n) => null]
  ];
  function attrSource(el) {
    let depth = 0;
    for (let n = el; n && n.getAttribute; n = composedParent(n), depth++) {
      for (const [attr, read] of ATTR_SOURCES) {
        if (!n.hasAttribute(attr)) continue;
        const raw = read(n);
        if (!raw) continue;
        const m = raw.replace(/:$/, '').match(/^(.*?)(?::(\d+))?(?::\d+)?$/);
        return { source: `${shortPath(m[1])}${m[2] ? ':' + m[2] : ''}`, sourceVia: depth ? `${attr} on an ancestor` : attr };
      }
      if (depth > 25) break;
    }
    return null;
  }

  // ---------- Server template annotations in HTML comments ----------
  // Rails (annotate_rendered_view_with_filenames), Phoenix debug_heex_annotations,
  // Drupal/Twig debug, Django/Jinja/Laravel debug helpers and similar.
  let commentsChecked = 0, hasTemplateComments = false;
  function pageHasTemplateComments() {
    if (Date.now() - commentsChecked < 10000) return hasTemplateComments;
    commentsChecked = Date.now();
    hasTemplateComments = false;
    const tw = d.createTreeWalker(d, NodeFilter.SHOW_COMMENT);
    for (let c, i = 0; (c = tw.nextNode()) && i < 5000; i++) if (PATH_RE.test(c.data)) { hasTemplateComments = true; break; }
    return hasTemplateComments;
  }
  function templates(el) {
    if (!pageHasTemplateComments()) return [];
    let anchor = el;
    while (anchor.getRootNode && anchor.getRootNode() instanceof ShadowRoot) anchor = anchor.getRootNode().host;
    const before = [];
    const tw = d.createTreeWalker(d, NodeFilter.SHOW_COMMENT);
    for (let c; (c = tw.nextNode());) {
      if (anchor.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) break;
      before.push(c);
    }
    const out = [];
    let depth = 0;
    for (let i = before.length - 1; i >= 0 && out.length < 5; i--) {
      const text = before[i].data.trim();
      if (/SUGGESTIONS|THEME DEBUG|THEME HOOK/i.test(text)) continue;
      const isClose = /^(END\b|<\/|\/|end[:\s])/i.test(text);
      const m = text.match(PATH_RE);
      if (isClose) { depth++; continue; }
      if (!m) continue;
      if (depth > 0) { depth--; continue; }
      out.push(`${shortPath(m[1])}${m[2] ? ':' + m[2] : ''}`);
    }
    return out; // innermost first
  }

  // ---------- Behaviour hooks wired in markup (no build step needed) ----------
  function behaviors(el) {
    const out = [];
    const near = (sel) => el.closest ? el.closest(sel) : null;
    // Stimulus (Hotwire)
    const ctrls = [];
    for (let n = el; n && n.getAttribute; n = n.parentElement) {
      const v = n.getAttribute('data-controller');
      if (v) v.split(/\s+/).forEach((c) => c && !ctrls.includes(c) && ctrls.push(c));
    }
    if (ctrls.length) out.push(`Stimulus controllers: ${ctrls.map((c) => `${c} (${c.replace(/--/g, '/').replace(/-/g, '_')}_controller)`).join(', ')}`);
    if (el.getAttribute && el.getAttribute('data-action')) out.push(`Stimulus action: ${clip(el.getAttribute('data-action'))}`);
    // Livewire
    const lw = near('[wire\\:id]');
    if (lw) {
      let name = null;
      try { const c = w.Livewire && w.Livewire.find(lw.getAttribute('wire:id')); name = c && (c.name || (c.__instance && c.__instance.name)); } catch { name = null; }
      out.push(`Livewire component: ${name || lw.getAttribute('wire:id')}`);
    }
    // Alpine
    const ax = near('[x-data]');
    if (ax) out.push(`Alpine x-data: ${clip(ax.getAttribute('x-data') || '{}')}`);
    // Attributes on the element itself
    if (el.attributes) {
      const hooks = [...el.attributes].filter((a) => /^(hx-|x-on:|@|wire:|phx-|v-on:|ng-click|\(click\)|on[a-z]+$|data-turbo|data-bs-|data-toggle|x-model|wire:model|v-model|ng-model)/.test(a.name));
      if (hooks.length) out.push(`Hooks: ${hooks.slice(0, 6).map((a) => `${a.name}="${clip(a.value, 50)}"`).join(', ')}`);
    }
    // htmx inherited target
    if (w.htmx) {
      const hx = near('[hx-get],[hx-post],[hx-put],[hx-patch],[hx-delete]');
      if (hx && hx !== el) {
        const a = [...hx.attributes].find((x) => /^hx-(get|post|put|patch|delete)$/.test(x.name));
        if (a) out.push(`htmx request from ancestor: ${a.name}="${clip(a.value, 60)}"`);
      }
    }
    // Phoenix LiveView component id
    const phx = near('[data-phx-component]');
    if (phx) out.push(`LiveView component id: ${phx.getAttribute('data-phx-component')}`);
    // jQuery handlers
    try {
      const jq = w.jQuery && w.jQuery._data && w.jQuery._data(el, 'events');
      if (jq) out.push(`jQuery handlers: ${Object.keys(jq).join(', ')}`);
    } catch { /* ignore */ }
    return out;
  }

  // ---------- Page stack ----------
  function stack() {
    const s = [];
    const add = (x) => { if (x && !s.includes(x)) s.push(x); };
    const has = (sel) => { try { return !!d.querySelector(sel); } catch { return false; } };
    const css = (v) => { try { return getComputedStyle(d.documentElement).getPropertyValue(v) || getComputedStyle(d.body).getPropertyValue(v); } catch { return ''; } };
    // Meta frameworks
    if (w.__NEXT_DATA__ || w.next || has('script[src*="/_next/"]')) add('Next.js');
    if (w.__NUXT__ || w.$nuxt || w.useNuxtApp) add('Nuxt');
    if (w.__remixContext || w.__reactRouterContext) add('Remix / React Router');
    if (w.___gatsby || has('#___gatsby')) add('Gatsby');
    if (Object.keys(w).some((k) => k.startsWith('__sveltekit'))) add('SvelteKit');
    if (has('astro-island,[data-astro-cid],[data-astro-source-file]')) add('Astro');
    if (has('[q\\:container]')) add('Qwik');
    // UI frameworks
    const sample = [...d.querySelectorAll('body *')].slice(0, 400);
    if (sample.some((n) => Object.keys(n).some((k) => k.startsWith('__react')))) add('React');
    if (w.preact || w.__PREACT_DEVTOOLS__) add('Preact');
    if (w.__VUE__ || w.Vue || has('[data-v-app]') || sample.some((n) => n.__vueParentComponent || n.__vue__)) add('Vue');
    const ngv = d.querySelector('[ng-version]');
    if (ngv) add(`Angular ${ngv.getAttribute('ng-version')}`);
    if (w.angular && w.angular.version) add(`AngularJS ${w.angular.version.full}`);
    if (w.__svelte || sample.some((n) => n.__svelte_meta) || has('[class*="svelte-"]')) add('Svelte');
    if (w._$HY || w.Solid$$) add('Solid');
    if (w.litElementVersions || w.litHtmlVersions) add('Lit');
    if (w.Stencil || has('[s-id]')) add('Stencil');
    if (w.Ember || w.EmberENV) add('Ember');
    if (w.m && typeof w.m.redraw === 'function') add('Mithril');
    if (w.ko && w.ko.version) add('Knockout');
    if (w.Backbone) add('Backbone');
    if (w.Alpine) add('Alpine.js');
    if (w.htmx) add('htmx');
    if (w.Stimulus || has('[data-controller]')) add('Stimulus');
    if (w.Turbo) add('Turbo');
    if (w.Livewire) add('Livewire');
    if (w.liveSocket || has('[data-phx-main],[data-phx-session]')) add('Phoenix LiveView');
    if (w.jQuery && w.jQuery.fn) add(`jQuery ${w.jQuery.fn.jquery}`);
    // Server / CMS / builders
    if (has('meta[name="csrf-param"][content="authenticity_token"]')) add('Rails');
    if (has('input[name="csrfmiddlewaretoken"]')) add('Django');
    if (w.Laravel || w.Livewire) add('Laravel');
    if (w.Shopify) add('Shopify');
    if (has('html[data-wf-site]')) add('Webflow');
    d.querySelectorAll('meta[name="generator"]').forEach((m) => add(clip(m.content, 40)));
    if (!s.some((x) => /wordpress/i.test(x)) && has('link[href*="/wp-content/"],script[src*="/wp-includes/"]')) add('WordPress');
    // Styling
    if (css('--tw-ring-offset-width') || css('--tw-border-style') || has('style[data-tailwind]')) add('Tailwind CSS');
    if (css('--bs-blue') || css('--bs-primary')) add('Bootstrap');
    if (has('[class*="Mui"]')) add('MUI');
    if (css('--chakra-colors-blue-500')) add('Chakra UI');
    if (css('--mantine-color-blue-6') || has('[class*="mantine-"]')) add('Mantine');
    if (has('style[data-styled]')) add('styled-components');
    if (has('style[data-emotion]')) add('Emotion');
    return s;
  }

  // ---------- Probe ----------
  function deepQuery(sel, root = d) {
    const hit = root.querySelector(sel);
    if (hit) return hit;
    for (const n of root.querySelectorAll('*')) {
      if (n.shadowRoot) { const r = deepQuery(sel, n.shadowRoot); if (r) return r; }
    }
    return null;
  }
  const DETECTORS = [react, vue, svelte, angular, preact, ember, webComponents];
  function inspect(el, full) {
    let info = null, fallback = null;
    for (const fn of DETECTORS) {
      let r = null;
      try { r = fn(el); } catch { r = null; }
      if (r && ((r.components && r.components.length) || r.source)) { info = r; break; }
      if (r && !fallback) fallback = r;
    }
    info = info || fallback || { framework: null, components: [] };
    info.components = (info.components || []).filter(Boolean).slice(-10);
    if (!full) return info;
    if (!info.source) {
      const a = attrSource(el);
      if (a) Object.assign(info, a);
    }
    try { info.templates = templates(el); } catch { info.templates = []; }
    if (!info.source && info.templates.length) { info.source = info.templates[0]; info.sourceVia = 'server template comment'; }
    try { info.behaviors = behaviors(el); } catch { info.behaviors = []; }
    return info;
  }

  d.addEventListener('pinpoint:probe', (e) => {
    let req = {};
    try { req = JSON.parse(e.detail); } catch { return; }
    let info = null;
    if (req.stack) {
      try { info = stack(); } catch { info = []; }
    } else {
      const el = deepQuery(`[data-pinpoint-probe="${req.id}"]`);
      if (el) { try { info = inspect(el, !!req.full); } catch { info = null; } }
    }
    d.dispatchEvent(new CustomEvent('pinpoint:probe-result', { detail: JSON.stringify({ id: req.id, info }) }));
  });
})();
