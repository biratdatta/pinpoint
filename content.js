// Pinpoint: toolbar, element picking, annotations and markdown export.
(() => {
  if (window.__pinpoint) return;
  window.__pinpoint = true;

  // ---------- State ----------
  const pageKey = () => 'ann:' + location.origin + location.pathname;
  const visKey = 'vis:' + location.origin;
  const state = {
    visible: false,
    active: false,
    paused: false,
    annotations: [],
    detail: 'standard',
    hoverEl: null,
    editing: null,
    suppressClick: false,
    key: pageKey()
  };
  const elCache = new Map();

  // ---------- Storage ----------
  const alive = () => { try { return !!chrome.runtime.id; } catch { return false; } };
  const store = {
    get: (k) => new Promise((r) => { if (!alive()) return r(undefined); chrome.storage.local.get(k, (v) => r(v ? v[k] : undefined)); }),
    set: (k, v) => new Promise((r) => { if (!alive()) return r(); chrome.storage.local.set({ [k]: v }, r); })
  };
  const save = () => store.set(state.key, state.annotations);

  // ---------- Icons ----------
  const svg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    annotate: svg('<path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>'),
    pause: svg('<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>'),
    play: svg('<path d="M8 5l11 7-11 7z"/>'),
    copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    clear: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    hide: svg('<path d="M6 6l12 12M18 6L6 18"/>')
  };

  // ---------- UI ----------
  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  [hidden]{display:none!important}
  :focus-visible{outline:2px solid #FFD43B;outline-offset:2px}
  .code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}

  .hl{position:fixed;pointer-events:none;border:1.5px solid #FFD43B;background:rgba(255,212,59,.12);border-radius:3px;z-index:1}
  .hl-label{position:absolute;left:-1.5px;bottom:100%;margin-bottom:4px;background:#1B2230;color:#F7F7F2;font-size:11px;line-height:1;padding:5px 7px;border-radius:5px;white-space:nowrap;max-width:420px;overflow:hidden;text-overflow:ellipsis}
  .hl-label.below{bottom:auto;top:100%;margin:4px 0 0}
  .hl-label .comp{color:#FFD43B;margin-right:6px}
  .hl-label .dim{color:#8A93A6;margin-left:6px}

  .mk{all:unset;position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#FFD43B;color:#1B2230;border:2px solid #1B2230;font-size:11px;font-weight:700;line-height:18px;text-align:center;cursor:pointer;z-index:2;box-shadow:0 2px 6px rgba(27,34,48,.35);transition:transform .12s}
  .mk:hover{transform:scale(1.15)}
  .mk.text{border-radius:5px}
  .mk.high{background:#E5484D;color:#fff}

  .pop{position:fixed;width:320px;background:#1B2230;color:#F7F7F2;border-radius:12px;padding:12px;z-index:4;box-shadow:0 16px 40px rgba(10,14,22,.38),0 0 0 1px rgba(255,255,255,.07)}
  .pop-target{display:block;font-size:12px;color:#FFD43B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pop-sub{display:block;font-size:11px;color:#8A93A6;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pop-quote{margin:10px 0 0;padding:6px 9px;border-left:2px solid #FFD43B;background:rgba(255,212,59,.08);font-size:12px;line-height:1.45;color:#D5D9E2;max-height:64px;overflow:auto;border-radius:0 6px 6px 0}
  .pop-text{display:block;width:100%;margin-top:10px;background:#262E3E;border:1px solid #343D50;color:#F7F7F2;border-radius:8px;padding:8px 10px;font-size:13px;line-height:1.45;resize:vertical;min-height:68px;outline:none}
  .pop-text::placeholder{color:#6F788B}
  .pop-text:focus{border-color:#FFD43B}
  .field{display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:8px}
  .field-label{font-size:12px;color:#8A93A6}
  .seg{display:inline-flex;background:#262E3E;border-radius:7px;padding:2px}
  .seg button{all:unset;cursor:pointer;font-size:12px;padding:4px 9px;border-radius:5px;color:#C4CAD6}
  .seg button:hover{color:#F7F7F2}
  .seg button[aria-pressed="true"]{background:#F7F7F2;color:#1B2230}
  .seg button[data-v="high"][aria-pressed="true"]{background:#E5484D;color:#fff}
  .actions{display:flex;align-items:center;gap:6px;margin-top:12px}
  .actions .sp{flex:1}
  .hint{font-size:11px;color:#6F788B}
  .btn{all:unset;cursor:pointer;font-size:13px;font-weight:500;padding:6px 12px;border-radius:7px}
  .btn.primary{background:#FFD43B;color:#1B2230}
  .btn.primary:hover{background:#FFDE66}
  .btn.ghost{color:#C4CAD6}
  .btn.ghost:hover{background:#262E3E;color:#F7F7F2}
  .btn.danger{color:#FF8A8D;padding-left:4px}
  .shake{animation:shake .28s}
  @keyframes shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}

  .bar{position:fixed;right:16px;bottom:16px;display:flex;align-items:center;gap:2px;background:#1B2230;padding:5px;border-radius:999px;z-index:5;box-shadow:0 10px 28px rgba(10,14,22,.32),0 0 0 1px rgba(255,255,255,.07)}
  .bar button{all:unset;position:relative;width:34px;height:34px;display:grid;place-items:center;border-radius:50%;color:#C4CAD6;cursor:pointer}
  .bar button:hover{background:#262E3E;color:#F7F7F2}
  .bar button[aria-pressed="true"]{background:#FFD43B;color:#1B2230}
  .badge{position:absolute;top:1px;right:1px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#FFD43B;color:#1B2230;font-size:10px;font-weight:700;line-height:16px;text-align:center}
  .sep{width:1px;height:18px;background:#343D50;margin:0 3px}

  .panel{position:fixed;right:16px;bottom:64px;width:272px;background:#1B2230;color:#F7F7F2;border-radius:12px;padding:12px;z-index:5;box-shadow:0 16px 40px rgba(10,14,22,.38),0 0 0 1px rgba(255,255,255,.07)}
  .panel h3{margin:0 0 8px;font-size:13px;font-weight:600}
  .opt{display:flex;gap:9px;align-items:flex-start;padding:7px 8px;border-radius:8px;cursor:pointer}
  .opt:hover{background:#262E3E}
  .opt input{accent-color:#FFD43B;margin:2px 0 0}
  .opt b{display:block;font-size:13px;font-weight:500}
  .opt span{display:block;font-size:12px;color:#8A93A6;margin-top:2px;line-height:1.4}

  .credit{margin:10px 8px 0;padding-top:10px;border-top:1px solid #343D50;font-size:11px;line-height:1.6;color:#8A93A6}
  .credit a{color:#C4CAD6;text-decoration:none;margin-right:8px}
  .credit a:hover{color:#FFD43B;text-decoration:underline}
  .toast{position:fixed;right:16px;bottom:64px;background:#F7F7F2;color:#1B2230;font-size:13px;font-weight:500;padding:8px 12px;border-radius:8px;z-index:6;opacity:0;transform:translateY(4px);transition:opacity .15s,transform .15s;pointer-events:none;box-shadow:0 8px 20px rgba(10,14,22,.25)}
  .toast.show{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
  `;

  const host = document.createElement('pinpoint-ui');
  host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
  <div class="hl" hidden><div class="hl-label"></div></div>
  <div class="markers"></div>
  <div class="pop" hidden role="dialog" aria-label="Annotation">
    <span class="pop-target code"></span>
    <span class="pop-sub code" hidden></span>
    <blockquote class="pop-quote" hidden></blockquote>
    <textarea class="pop-text" rows="3" placeholder="What should change?" aria-label="Feedback"></textarea>
    <div class="field"><span class="field-label">Type</span>
      <div class="seg" data-group="intent"><button data-v="fix">Fix</button><button data-v="change">Change</button><button data-v="question">Question</button></div></div>
    <div class="field"><span class="field-label">Priority</span>
      <div class="seg" data-group="priority"><button data-v="low">Low</button><button data-v="normal">Normal</button><button data-v="high">High</button></div></div>
    <div class="actions">
      <button class="btn danger" data-act="delete" hidden>Delete</button>
      <span class="sp"></span>
      <button class="btn ghost" data-act="cancel">Cancel</button>
      <button class="btn primary" data-act="save">Add</button>
    </div>
  </div>
  <div class="panel" hidden role="dialog" aria-label="Output detail">
    <h3>Output detail</h3>
    <label class="opt"><input type="radio" name="detail" value="compact"><div><b>Compact</b><span>Selector, selected text and your note</span></div></label>
    <label class="opt"><input type="radio" name="detail" value="standard"><div><b>Standard</b><span>Adds component tree, source file and DOM path</span></div></label>
    <label class="opt"><input type="radio" name="detail" value="full"><div><b>Full</b><span>Adds position, attributes and computed styles</span></div></label>
    <p class="credit">Made by Birat Datta<br><a href="https://biratdatta.tech" target="_blank" rel="noopener">biratdatta.tech</a> <a href="mailto:birat.datta26@gmail.com">birat.datta26@gmail.com</a></p>
  </div>
  <div class="bar" hidden role="toolbar" aria-label="Pinpoint">
    <button data-act="annotate" aria-pressed="false" title="Annotate (Alt+Shift+A)" aria-label="Annotate">${ICON.annotate}</button>
    <button data-act="pause" aria-pressed="false" title="Pause animations" aria-label="Pause animations">${ICON.pause}</button>
    <button data-act="copy" title="Copy feedback as markdown" aria-label="Copy feedback">${ICON.copy}<span class="badge" hidden>0</span></button>
    <button data-act="settings" aria-pressed="false" title="Output detail" aria-label="Output detail">${ICON.settings}</button>
    <button data-act="clear" title="Clear annotations on this page" aria-label="Clear annotations">${ICON.clear}</button>
    <span class="sep"></span>
    <button data-act="hide" title="Hide Pinpoint" aria-label="Hide Pinpoint">${ICON.hide}</button>
  </div>
  <div class="toast" role="status" aria-live="polite"></div>`;

  const $ = (s) => root.querySelector(s);
  const ui = {
    hl: $('.hl'), hlLabel: $('.hl-label'), markers: $('.markers'), pop: $('.pop'),
    popTarget: $('.pop-target'), popSub: $('.pop-sub'), popQuote: $('.pop-quote'), popText: $('.pop-text'),
    del: $('[data-act="delete"]'), saveBtn: $('[data-act="save"]'),
    panel: $('.panel'), bar: $('.bar'), badge: $('.badge'), toast: $('.toast'),
    annotateBtn: $('[data-act="annotate"]'), pauseBtn: $('[data-act="pause"]'), settingsBtn: $('[data-act="settings"]')
  };
  document.documentElement.appendChild(host);

  // Keep page shortcuts from firing while typing in our UI.
  ['keydown', 'keyup', 'keypress'].forEach((t) => host.addEventListener(t, (e) => e.stopPropagation()));

  const globalStyle = document.createElement('style');
  globalStyle.textContent = 'html.pinpoint-active, html.pinpoint-active *{cursor:crosshair!important}';
  (document.head || document.documentElement).appendChild(globalStyle);

  // ---------- Element description ----------
  const esc = (typeof CSS !== 'undefined' && CSS.escape) ? (v) => CSS.escape(v) : (v) => String(v).replace(/([^\w-])/g, '\\$1');
  const goodId = (id) => /^[A-Za-z][\w-]*$/.test(id) && !/\d{4,}/.test(id) && !/^(radix|headlessui|react-aria|mui|rc-|ember)/i.test(id);
  const hashy = (c) => c.length >= 6 && /\d/.test(c) && /[a-z]/i.test(c) && !/[-_]/.test(c);
  const stableClasses = (el) => [...el.classList].filter((c) =>
    c.length <= 40 && /^-?[A-Za-z_][\w-]*$/.test(c) && !/^(css|sc|jsx|emotion|svelte|astro)-/.test(c) && !hashy(c) && !c.startsWith('pinpoint'));

  function labelFor(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id && goodId(el.id)) return `${tag}#${el.id}`;
    return tag + stableClasses(el).slice(0, 2).map((c) => '.' + c).join('');
  }

  function segFor(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id && goodId(el.id)) return '#' + esc(el.id);
    for (const a of ['data-testid', 'data-test', 'data-cy', 'data-qa']) {
      const v = el.getAttribute(a);
      if (v) return `${tag}[${a}="${v.replace(/"/g, '\\"')}"]`;
    }
    let s = tag + stableClasses(el).slice(0, 2).map((c) => '.' + esc(c)).join('');
    const p = el.parentElement;
    if (p) {
      const kids = [...p.children];
      let matches = 0;
      try { matches = kids.filter((c) => c.matches(s)).length; } catch { matches = 2; }
      if (matches > 1) s += `:nth-of-type(${kids.filter((c) => c.tagName === el.tagName).indexOf(el) + 1})`;
    }
    return s;
  }

  const composedParent = (n) => n.parentElement || (n.getRootNode && n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null);

  // Selector unique within its own document or shadow root.
  function selectorIn(el, root) {
    const parts = [];
    for (let cur = el; cur && cur.nodeType === 1 && cur !== document.documentElement; cur = cur.parentElement) {
      parts.unshift(segFor(cur));
      const sel = parts.join(' > ');
      try { if (root.querySelectorAll(sel).length === 1) return sel; } catch { /* keep climbing */ }
      if (cur === document.body) break;
    }
    return parts.join(' > ');
  }

  // Crosses open shadow roots with ">>>" (the deep combinator Puppeteer and Playwright understand).
  function selectorFor(el) {
    const chunks = [];
    for (let cur = el; cur;) {
      const root = cur.getRootNode();
      chunks.unshift(selectorIn(cur, root instanceof ShadowRoot ? root : document));
      cur = root instanceof ShadowRoot ? root.host : null;
    }
    return chunks.join(' >>> ');
  }

  function query(sel) {
    const chunks = String(sel).split(' >>> ');
    let scope = document, el = null;
    for (let i = 0; i < chunks.length; i++) {
      try { el = scope.querySelector(chunks[i]); } catch { return null; }
      if (!el) return null;
      if (i < chunks.length - 1) { if (!el.shadowRoot) return null; scope = el.shadowRoot; }
    }
    return el;
  }

  function domPath(el) {
    const out = [];
    for (let cur = el; cur && cur !== document.body && cur.nodeType === 1 && out.length < 6; cur = composedParent(cur)) out.unshift(labelFor(cur));
    return out.join(' > ');
  }

  const STYLE_KEYS = ['display', 'position', 'width', 'height', 'margin', 'padding', 'color', 'background-color',
    'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'border', 'border-radius',
    'box-shadow', 'gap', 'flex-direction', 'align-items', 'justify-content', 'opacity', 'z-index', 'overflow'];
  const BORING = new Set(['', 'none', 'normal', 'auto', 'static', 'visible', '0px', 'rgba(0, 0, 0, 0)', 'start', 'row', '1', '0px none rgb(0, 0, 0)']);

  function stylesFor(el) {
    const cs = getComputedStyle(el);
    const out = {};
    STYLE_KEYS.forEach((k) => { const v = cs.getPropertyValue(k); if (!BORING.has(v)) out[k] = v; });
    return out;
  }

  function attrsFor(el) {
    const out = {};
    ['id', 'role', 'aria-label', 'href', 'type', 'name', 'placeholder', 'alt', 'title', 'data-testid'].forEach((a) => {
      const v = el.getAttribute(a);
      if (v) out[a] = v.length > 120 ? v.slice(0, 117) + '…' : v;
    });
    return out;
  }

  const textFor = (el) => ((el.innerText || el.textContent || el.value || el.getAttribute('alt') || el.getAttribute('aria-label') || '') + '')
    .trim().replace(/\s+/g, ' ').slice(0, 90);

  let probeSeq = 0;
  function probe(el, full) {
    const id = 'p' + (++probeSeq);
    let result = null;
    const onResult = (e) => { try { const d = JSON.parse(e.detail); if (d.id === id) result = d.info; } catch { /* ignore */ } };
    el.setAttribute('data-pinpoint-probe', id);
    document.addEventListener('pinpoint:probe-result', onResult);
    document.dispatchEvent(new CustomEvent('pinpoint:probe', { detail: JSON.stringify({ id, full: !!full }) }));
    document.removeEventListener('pinpoint:probe-result', onResult);
    el.removeAttribute('data-pinpoint-probe');
    return result;
  }

  function pageStack() {
    const id = 's' + (++probeSeq);
    let result = [];
    const onResult = (e) => { try { const d = JSON.parse(e.detail); if (d.id === id) result = d.info || []; } catch { /* ignore */ } };
    document.addEventListener('pinpoint:probe-result', onResult);
    document.dispatchEvent(new CustomEvent('pinpoint:probe', { detail: JSON.stringify({ id, stack: true }) }));
    document.removeEventListener('pinpoint:probe-result', onResult);
    return result;
  }

  function collect(el) {
    const r = el.getBoundingClientRect();
    return {
      selector: selectorFor(el),
      label: labelFor(el),
      path: domPath(el),
      tag: el.tagName.toLowerCase(),
      elementText: textFor(el),
      attrs: attrsFor(el),
      styles: stylesFor(el),
      rect: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      framework: probe(el, true)
    };
  }

  // ---------- Highlight ----------
  let hoverInfo = null;
  function showHL(el) {
    if (!el) return hideHL();
    const r = el.getBoundingClientRect();
    Object.assign(ui.hl.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    ui.hl.hidden = false;
    ui.hlLabel.classList.toggle('below', r.top < 28);
  }
  function setHLLabel(el) {
    const fw = hoverInfo && hoverInfo.components && hoverInfo.components.length ? hoverInfo.components[hoverInfo.components.length - 1] : null;
    const r = el.getBoundingClientRect();
    ui.hlLabel.innerHTML = '';
    if (fw) { const c = document.createElement('span'); c.className = 'comp'; c.textContent = '<' + fw + '>'; ui.hlLabel.append(c); }
    const l = document.createElement('span'); l.className = 'code'; l.textContent = labelFor(el); ui.hlLabel.append(l);
    const d = document.createElement('span'); d.className = 'dim'; d.textContent = `${Math.round(r.width)}×${Math.round(r.height)}`; ui.hlLabel.append(d);
  }
  const hideHL = () => { ui.hl.hidden = true; };

  // ---------- Markers ----------
  function resolve(a) {
    let el = elCache.get(a.id);
    if (el && el.isConnected) return el;
    el = query(a.selector);
    if (el) elCache.set(a.id, el);
    return el;
  }

  function renderMarkers() {
    ui.markers.innerHTML = '';
    state.annotations.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'mk' + (a.selectedText ? ' text' : '') + (a.priority === 'high' ? ' high' : '');
      b.textContent = String(i + 1);
      b.dataset.id = a.id;
      b.title = a.comment;
      b.setAttribute('aria-label', `Annotation ${i + 1}: ${a.comment}`);
      ui.markers.append(b);
    });
    const n = state.annotations.length;
    ui.badge.hidden = n === 0;
    ui.badge.textContent = String(n);
    position();
  }

  function markerPoint(a) {
    const el = resolve(a);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + a.fx * r.width, y: r.top + a.fy * r.height };
    }
    return { x: a.docX - scrollX, y: a.docY - scrollY };
  }

  function position() {
    if (!state.visible) return;
    [...ui.markers.children].forEach((b) => {
      const a = state.annotations.find((x) => x.id === b.dataset.id);
      if (!a) return;
      const p = markerPoint(a);
      b.style.left = p.x + 'px';
      b.style.top = p.y + 'px';
    });
    const target = state.editing ? state.editing.el : state.hoverEl;
    if (target && !ui.hl.hidden) showHL(target);
  }

  let rafPending = false;
  const schedule = () => { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; position(); }); };
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);

  // ---------- Popover ----------
  function setSeg(group, value) {
    root.querySelectorAll(`.seg[data-group="${group}"] button`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === value)));
  }

  function openPop(point) {
    const d = state.editing.data;
    ui.popTarget.textContent = d.label;
    const comps = d.framework && d.framework.components;
    if (comps && comps.length) {
      ui.popSub.textContent = comps.slice(-3).join(' › ') + (d.framework.source ? '  ' + d.framework.source : '');
      ui.popSub.hidden = false;
    } else ui.popSub.hidden = true;
    ui.popQuote.hidden = !d.selectedText;
    ui.popQuote.textContent = d.selectedText ? '“' + d.selectedText + '”' : '';
    ui.popText.value = d.comment || '';
    setSeg('intent', d.intent);
    setSeg('priority', d.priority);
    ui.del.hidden = state.editing.mode !== 'edit';
    ui.saveBtn.textContent = state.editing.mode === 'edit' ? 'Save' : 'Add';
    ui.pop.hidden = false;
    const w = 320, h = ui.pop.offsetHeight, m = 12;
    let left = point.x + 14, top = point.y + 14;
    if (left + w > innerWidth - m) left = point.x - w - 14;
    if (left < m) left = m;
    if (top + h > innerHeight - m) top = innerHeight - h - m;
    if (top < m) top = m;
    ui.pop.style.left = left + 'px';
    ui.pop.style.top = top + 'px';
    showHL(state.editing.el);
    setTimeout(() => ui.popText.focus(), 0);
  }

  function closePop() {
    state.editing = null;
    ui.pop.hidden = true;
    hideHL();
    state.hoverEl = null;
  }

  function shakePop() {
    ui.pop.classList.remove('shake');
    void ui.pop.offsetWidth;
    ui.pop.classList.add('shake');
    ui.popText.focus();
  }

  function startNew(el, point, selectedText) {
    const r = el.getBoundingClientRect();
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const info = collect(el);
    state.editing = {
      mode: 'new', el,
      data: {
        ...info,
        comment: '', intent: 'fix', priority: 'normal',
        selectedText: selectedText || '',
        fx: r.width ? clamp((point.x - r.left) / r.width) : 0.5,
        fy: r.height ? clamp((point.y - r.top) / r.height) : 0.5,
        docX: point.x + scrollX, docY: point.y + scrollY
      }
    };
    openPop(point);
  }

  function startEdit(a) {
    const el = resolve(a) || document.body;
    state.editing = { mode: 'edit', id: a.id, el, data: { ...a } };
    openPop(markerPoint(a));
  }

  function commit() {
    const comment = ui.popText.value.trim();
    if (!comment) return shakePop();
    const ed = state.editing;
    ed.data.comment = comment;
    if (ed.mode === 'new') {
      const a = { id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()), createdAt: new Date().toISOString(), ...ed.data };
      elCache.set(a.id, ed.el);
      state.annotations.push(a);
    } else {
      const i = state.annotations.findIndex((x) => x.id === ed.id);
      if (i >= 0) state.annotations[i] = { ...state.annotations[i], ...ed.data, updatedAt: new Date().toISOString() };
    }
    save();
    closePop();
    renderMarkers();
  }

  function removeEditing() {
    const id = state.editing && state.editing.id;
    state.annotations = state.annotations.filter((a) => a.id !== id);
    elCache.delete(id);
    save();
    closePop();
    renderMarkers();
  }

  ui.pop.addEventListener('click', (e) => {
    const seg = e.target.closest('.seg button');
    if (seg && state.editing) {
      const group = seg.parentElement.dataset.group;
      state.editing.data[group] = seg.dataset.v;
      setSeg(group, seg.dataset.v);
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'save') commit();
    if (act.dataset.act === 'cancel') closePop();
    if (act.dataset.act === 'delete') removeEditing();
  });
  ui.popText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
  });
  ui.popText.addEventListener('input', () => { if (state.editing) state.editing.data.comment = ui.popText.value; });

  ui.markers.addEventListener('click', (e) => {
    const b = e.target.closest('.mk');
    if (!b) return;
    const a = state.annotations.find((x) => x.id === b.dataset.id);
    if (a) startEdit(a);
  });

  // ---------- Markdown output ----------
  const tick = (s) => '`' + String(s).replace(/`/g, '\\`') + '`';
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';

  function buildMarkdown() {
    const d = state.detail;
    const list = state.annotations;
    let md = `# UI feedback for ${location.host}${location.pathname}\n\n`;
    md += `- URL: ${location.href}\n- Viewport: ${innerWidth}×${innerHeight}\n- Annotations: ${list.length}\n`;
    const stackList = pageStack();
    if (stackList.length) md += `- Stack (detected): ${stackList.join(', ')}\n`;
    if (list.some((a) => a.selector.includes(' >>> '))) md += '- Note: `>>>` in a selector steps into a shadow root\n';
    md += '\n';
    list.forEach((a, i) => {
      md += `## ${i + 1}. ${cap(a.intent)}${a.priority !== 'normal' ? ` (${a.priority} priority)` : ''}: ${tick(a.label)}\n\n`;
      md += `${a.comment}\n\n`;
      md += `- Selector: ${tick(a.selector)}\n`;
      if (a.selectedText) md += `- Selected text: "${a.selectedText}"\n`;
      if (d !== 'compact') {
        if (a.elementText && !a.selectedText) md += `- Element: <${a.tag}> "${a.elementText}"\n`;
        else md += `- Element: <${a.tag}>\n`;
        const f = a.framework || {};
        if (f.components && f.components.length) md += `- Components${f.framework ? ` (${f.framework})` : ''}: ${f.components.join(' > ')}\n`;
        if (f.source) md += `- Source: ${tick(f.source)}${f.sourceVia ? ` (from ${f.sourceVia})` : ''}\n`;
        if (f.templates && f.templates.length > (f.sourceVia === 'server template comment' ? 1 : 0)) md += `- Templates (innermost first): ${f.templates.map(tick).join(' < ')}\n`;
        (f.behaviors || []).forEach((b) => { md += `- ${b}\n`; });
        if (a.path && a.path !== a.label) md += `- DOM path: ${tick(a.path)}\n`;
      }
      if (d === 'full') {
        md += `- Position: x ${a.rect.x}, y ${a.rect.y}, ${a.rect.w}×${a.rect.h}px (page coordinates)\n`;
        const attrs = Object.entries(a.attrs || {});
        if (attrs.length) md += `- Attributes: ${attrs.map(([k, v]) => `${k}="${v}"`).join(', ')}\n`;
        const st = Object.entries(a.styles || {});
        if (st.length) md += `- Computed styles:\n\`\`\`css\n${st.map(([k, v]) => `${k}: ${v};`).join('\n')}\n\`\`\`\n`;
      }
      md += '\n';
    });
    return md.trim() + '\n';
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }

  let toastTimer;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1800);
  }

  // ---------- Pause animations ----------
  let pauseStyle = null, pausedAnims = [], pausedMedia = [];
  function setPaused(p) {
    state.paused = p;
    ui.pauseBtn.setAttribute('aria-pressed', String(p));
    ui.pauseBtn.innerHTML = p ? ICON.play : ICON.pause;
    ui.pauseBtn.title = p ? 'Resume animations' : 'Pause animations';
    ui.pauseBtn.setAttribute('aria-label', ui.pauseBtn.title);
    document.dispatchEvent(new CustomEvent('pinpoint:freeze', { detail: p ? 'on' : 'off' }));
    if (p) {
      pausedAnims = (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === 'running');
      pausedAnims.forEach((a) => { try { a.pause(); } catch { /* ignore */ } });
      pauseStyle = document.createElement('style');
      pauseStyle.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition-duration:0s!important;transition-delay:0s!important}';
      (document.head || document.documentElement).appendChild(pauseStyle);
      pausedMedia = [...document.querySelectorAll('video,audio')].filter((v) => !v.paused);
      pausedMedia.forEach((v) => v.pause());
    } else {
      if (pauseStyle) pauseStyle.remove();
      pausedAnims.forEach((a) => { try { a.play(); } catch { /* ignore */ } });
      pausedMedia.forEach((v) => v.play().catch(() => {}));
      pausedAnims = []; pausedMedia = [];
    }
  }

  // ---------- Modes ----------
  function setActive(a) {
    state.active = a;
    ui.annotateBtn.setAttribute('aria-pressed', String(a));
    document.documentElement.classList.toggle('pinpoint-active', a);
    if (!a) { closePop(); hideHL(); }
  }

  function setVisible(v) {
    state.visible = v;
    ui.bar.hidden = !v;
    ui.markers.hidden = !v;
    if (!v) {
      setActive(false);
      ui.panel.hidden = true;
      ui.settingsBtn.setAttribute('aria-pressed', 'false');
      if (state.paused) setPaused(false);
    } else position();
    store.set(visKey, v);
  }

  ui.bar.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'annotate') setActive(!state.active);
    if (act === 'pause') setPaused(!state.paused);
    if (act === 'copy') {
      if (!state.annotations.length) return toast('Add an annotation first');
      const ok = await copyText(buildMarkdown());
      const n = state.annotations.length;
      toast(ok ? `Copied ${n} annotation${n === 1 ? '' : 's'}` : 'Copy failed. Check clipboard permissions.');
    }
    if (act === 'settings') {
      ui.panel.hidden = !ui.panel.hidden;
      b.setAttribute('aria-pressed', String(!ui.panel.hidden));
    }
    if (act === 'clear') {
      const n = state.annotations.length;
      if (!n) return toast('No annotations on this page');
      if (!confirm(`Clear ${n} annotation${n === 1 ? '' : 's'} on this page?`)) return;
      state.annotations = [];
      elCache.clear();
      save();
      closePop();
      renderMarkers();
      toast('Cleared');
    }
    if (act === 'hide') setVisible(false);
  });

  ui.panel.addEventListener('change', (e) => {
    if (e.target.name !== 'detail') return;
    state.detail = e.target.value;
    store.set('settings', { detail: state.detail });
  });

  // ---------- Page events ----------
  const isOurs = (e) => e.composedPath().includes(host);
  const targetOf = (e) => {
    const t = e.composedPath()[0];
    if (!t) return null;
    return t.nodeType === 1 ? t : t.parentElement;
  };

  window.addEventListener('mousemove', (e) => {
    if (!state.active || state.editing) return;
    if (isOurs(e)) { hideHL(); state.hoverEl = null; return; }
    const el = targetOf(e);
    if (!el || el === document.documentElement) return hideHL();
    if (el !== state.hoverEl) {
      state.hoverEl = el;
      hoverInfo = probe(el, false);
      setHLLabel(el);
    }
    showHL(el);
  }, true);

  const swallow = (e) => { if (state.active && !isOurs(e)) e.stopPropagation(); };
  ['pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach((t) => window.addEventListener(t, swallow, true));

  window.addEventListener('mousedown', (e) => {
    if (!state.active || isOurs(e)) return;
    e.stopPropagation();
    if (state.editing) {
      // Clicking the page while a note is open: keep a typed note, otherwise dismiss.
      e.preventDefault();
      state.suppressClick = true;
      if (ui.popText.value.trim()) shakePop(); else closePop();
    }
  }, true);

  window.addEventListener('mouseup', (e) => {
    if (!state.active || isOurs(e)) return;
    e.stopPropagation();
    if (state.editing) return;
    const sel = window.getSelection();
    const text = sel && !sel.isCollapsed ? sel.toString().trim().replace(/\s+/g, ' ') : '';
    if (!text) return;
    const range = sel.getRangeAt(0);
    let anchor = range.commonAncestorContainer;
    if (anchor.nodeType !== 1) anchor = anchor.parentElement;
    if (!anchor) return;
    const r = range.getBoundingClientRect();
    state.suppressClick = true;
    setTimeout(() => { state.suppressClick = false; }, 0);
    startNew(anchor, { x: r.right, y: r.top + r.height / 2 }, text.slice(0, 300));
  }, true);

  ['click', 'dblclick', 'auxclick'].forEach((type) => window.addEventListener(type, (e) => {
    if (!state.active || isOurs(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (type !== 'click') return;
    if (state.suppressClick) { state.suppressClick = false; return; }
    if (state.editing) return;
    const el = targetOf(e);
    if (el) startNew(el, { x: e.clientX, y: e.clientY });
  }, true));

  window.addEventListener('submit', (e) => { if (state.active) { e.preventDefault(); e.stopPropagation(); } }, true);

  window.addEventListener('keydown', (e) => {
    if (!state.visible || e.key !== 'Escape') return;
    if (state.editing) { e.stopPropagation(); closePop(); }
    else if (!ui.panel.hidden) { ui.panel.hidden = true; ui.settingsBtn.setAttribute('aria-pressed', 'false'); }
    else if (state.active) setActive(false);
  }, true);

  // ---------- Messages ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'toggle') {
      const v = !state.visible;
      setVisible(v);
      if (v) setActive(true);
    }
    if (msg.type === 'annotate') {
      if (!state.visible) setVisible(true);
      setActive(!state.active);
    }
  });

  // ---------- Init and SPA route changes ----------
  async function loadPage() {
    state.key = pageKey();
    elCache.clear();
    state.annotations = (await store.get(state.key)) || [];
    renderMarkers();
  }

  (async () => {
    const settings = (await store.get('settings')) || {};
    state.detail = settings.detail || 'standard';
    const radio = root.querySelector(`input[value="${state.detail}"]`);
    if (radio) radio.checked = true;
    await loadPage();
    if (await store.get(visKey)) setVisible(true);
  })();

  setInterval(() => {
    if (!host.isConnected) document.documentElement.appendChild(host);
    if (pageKey() !== state.key) { closePop(); loadPage(); }
    else if (state.visible && state.annotations.length) position();
  }, 700);
})();
