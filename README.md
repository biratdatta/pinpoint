# Pinpoint

Made by **Birat Datta** · [biratdatta.tech](https://biratdatta.tech) · [birat.datta26@gmail.com](mailto:birat.datta26@gmail.com)

Click any element on any page, leave a note, and copy structured feedback your AI coding agent can act on.

## Install (unpacked)

1. Unzip this folder somewhere permanent.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `pinpoint` folder.
4. Pin the extension so its icon is in your toolbar.
5. For local `file://` pages, open the extension's details and turn on **Allow access to file URLs**.

Already-open tabs pick it up the first time you click the icon.

## Use it

1. Click the Pinpoint icon (or press **Alt+Shift+A**). The toolbar appears bottom-right and annotate mode turns on.
2. Hover to see each element's name, React/Vue component and size.
3. Click an element, or select text, to add a note. Pick a type (Fix, Change, Question) and priority. **Cmd/Ctrl+Enter** adds it.
4. Numbered markers stay on the page. Click one to edit or delete it.
5. Click **Copy** and paste the markdown into Claude Code, Codex, Cursor or any agent.

Toolbar: annotate, pause animations, copy, output detail, clear page, hide. **Esc** closes the note, then leaves annotate mode.

While annotating, page clicks are blocked so buttons and links don't fire. Notes are saved per page (origin + path) in local extension storage.

## What the output includes

| Detail   | Contents |
|----------|----------|
| Compact  | Selector, selected text, your note, type and priority |
| Standard | Adds element text, component tree, source file and line, DOM path |
| Full     | Adds page position, key attributes and computed styles |

## Works with any stack

Selector, element text, DOM path, position and styles come from the browser, so they work on every site. On top of that, Pinpoint reads whatever extra context the page exposes:

| Stack | What you get |
|-------|--------------|
| React, Next.js, Remix, Gatsby | Component tree; exact file and line in dev (React 19: approximate) |
| Vue 2/3, Nuxt | Component tree and `.vue` file |
| Svelte, SvelteKit | Component tree, file and line |
| Angular (dev) | Component class tree; prod falls back to host element tags |
| AngularJS, Ember, Preact | Controller or component names where the page exposes them |
| Lit, Stencil, Shoelace, any web component | Custom element chain with class names; selectors step into Shadow DOM with `>>>` |
| Rails, Phoenix, Drupal/Twig and other server templates | The partial and layout that rendered the element, read from debug HTML comments |
| Stimulus, Livewire, Alpine, htmx, LiveView, jQuery | Controllers, component names, `x-data`, `hx-*`, `phx-*`, `wire:*` and bound event handlers |
| Astro, Qwik, and any framework using an inspector plugin | Exact file and line from source attributes |
| Plain HTML, WordPress, Webflow, Shopify | Selector, text, styles, plus detected CMS or builder |

The copied output also lists the detected stack (for example "Next.js, React, Tailwind CSS").

### Get exact file and line on any framework

Install a dev-only inspector plugin; Pinpoint reads its attributes automatically:

- **Vite or webpack, any framework (React, Vue, Svelte, Solid, Preact, Qwik):** [code-inspector-plugin](https://github.com/zh-lx/code-inspector)
- **Vue:** `vite-plugin-vue-inspector`
- **React:** `react-dev-inspector`
- **Astro:** built in during `astro dev`
- **Rails:** set `config.action_view.annotate_rendered_view_with_filenames = true` in `development.rb`
- **Phoenix:** set `config :phoenix_live_view, debug_heex_annotations: true` in `dev.exs`
- **Drupal:** turn on Twig debug mode

## Known limits

- Closed shadow roots can't be entered, so you get the host element there.
- Solid and other frameworks that keep no link from DOM to component show no component tree unless you add an inspector plugin.
- Iframes (for example the Storybook canvas) aren't annotated from the parent page. Open the iframe URL directly.
- Pausing freezes CSS animations, transitions, Web Animations, video and `requestAnimationFrame` loops. Animations driven by `setTimeout` keep running.
- Chrome blocks extensions on `chrome://` pages and the Chrome Web Store.

## Files

- `manifest.json`: extension config (Manifest V3)
- `background.js`: toolbar icon and keyboard shortcut
- `content.js`: toolbar, element picking, notes, markers, markdown export
- `main.js`: runs in the page's own JS world to detect frameworks, components, source files, templates and behaviour hooks, and to freeze animation frames

## Author

Birat Datta
- Website: https://biratdatta.tech
- Email: birat.datta26@gmail.com
