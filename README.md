<p align="center">
  <img src="icons/128.png" width="96" height="96" alt="Pinpoint icon">
</p>

<h1 align="center">Pinpoint</h1>

<p align="center">
  <strong>Point at the problem. Your agent finds the code.</strong><br>
  Click any element on any page, leave a note, and copy structured feedback your AI coding agent can act on.
</p>

<p align="center">
  <a href="https://github.com/biratdatta/pinpoint/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/biratdatta/pinpoint?label=release"></a>
  <img alt="Chrome Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white">
  <img alt="No tracking" src="https://img.shields.io/badge/data-stays%20local-2ea44f">
</p>

<p align="center">
  <a href="https://github.com/biratdatta/pinpoint/releases/latest/download/pinpoint-v1.0.0.zip"><strong>⬇ Download pinpoint-v1.0.0.zip</strong></a>
</p>

<p align="center">
  <a href="https://www.producthunt.com/products/pinpoint-11?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-pinpoint-d0472034-b6a7-4d15-8d22-64a12966c114" target="_blank" rel="noopener noreferrer"><img alt="Pinpoint - Point at UI bugs. Your AI coding agent finds the code. | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1306102&amp;theme=light&amp;t=1794022946639"></a>
</p>

---

## Why

"The button on the settings page looks off" gives an agent little to go on. Pinpoint turns that into a selector, the component tree, and often the exact source file and line, so Claude Code, Codex, Cursor or any other agent can go straight to the code.

## Install

Pinpoint isn't on the Chrome Web Store yet, so you load it unpacked. It takes about a minute.

1. Download **[`pinpoint-v1.0.0.zip`](https://github.com/biratdatta/pinpoint/releases/latest/download/pinpoint-v1.0.0.zip)** from the [latest release](https://github.com/biratdatta/pinpoint/releases/latest) and unzip it somewhere permanent. Chrome loads the extension from that folder, so don't delete it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `pinpoint` folder.
4. Pin Pinpoint to your toolbar.
5. *Optional:* to annotate local `file://` pages, open the extension's **Details** and turn on **Allow access to file URLs**.

Tabs that were already open pick it up the first time you click the icon.

<details>
<summary>Or install from source</summary>

```bash
git clone https://github.com/biratdatta/pinpoint.git
```

Then follow steps 2–4 above and select the cloned folder. To update, run `git pull` and click the reload icon on the extension card.
</details>

## How to use it

1. Click the Pinpoint icon or press **Alt+Shift+A**. The toolbar appears bottom-right and annotate mode turns on.
2. Hover over the page to see each element's name, component and size.
3. Click an element, or select some text, and write a note. Pick a type (**Fix**, **Change**, **Question**) and a priority.
4. Numbered markers stay on the page. Click one to edit or delete it.
5. Click **Copy** and paste the result into your agent.

While annotating, clicks on the page are blocked so buttons and links don't fire. Notes are saved per page (origin + path).

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| **Alt+Shift+A** | Start or stop annotating (change it at `chrome://extensions/shortcuts`) |
| **Cmd/Ctrl+Enter** | Add the note |
| **Esc** | Close the note, then leave annotate mode |

### Toolbar

Annotate · Pause animations · Copy · Output detail · Clear page · Hide

## What gets copied

Here's an example of what you paste into your agent (Standard detail):

```markdown
# UI feedback for localhost:3000/settings

- URL: http://localhost:3000/settings
- Viewport: 1440×900
- Annotations: 1
- Stack (detected): Next.js, React, Tailwind CSS

## 1. Fix (high priority): `button.save-btn`

The Save button is misaligned with the Cancel button on mobile.

- Selector: `#settings-form > div.actions > button.save-btn`
- Element: <button> "Save changes"
- Components (React): SettingsPage > SettingsForm > FormActions > Button
- Source: `src/components/FormActions.tsx:42`
- DOM path: `main > form#settings-form > div.actions > button.save-btn`
```

Choose how much detail to include:

| Detail | Contents |
|--------|----------|
| **Compact** | Selector, selected text, your note, type and priority |
| **Standard** | Adds element text, component tree, source file and line, DOM path |
| **Full** | Adds page position, key attributes and computed styles |

## Works with any stack

The selector, element text, DOM path, position and styles come from the browser, so they work on every site. Pinpoint also reads any extra context the page exposes:

| Stack | What you get |
|-------|--------------|
| React, Next.js, Remix, Gatsby | Component tree; exact file and line in dev (React 19: approximate) |
| Vue 2/3, Nuxt | Component tree and `.vue` file |
| Svelte, SvelteKit | Component tree, file and line |
| Angular (dev) | Component class tree; in prod, the host element tags |
| AngularJS, Ember, Preact | Controller or component names where the page exposes them |
| Lit, Stencil, Shoelace, any web component | Custom element chain with class names; selectors step into Shadow DOM with `>>>` |
| Rails, Phoenix, Drupal/Twig and other server templates | The partial and layout that rendered the element, read from debug HTML comments |
| Stimulus, Livewire, Alpine, htmx, LiveView, jQuery | Controllers, component names, `x-data`, `hx-*`, `phx-*`, `wire:*` and bound event handlers |
| Astro, Qwik, and any framework using an inspector plugin | Exact file and line from source attributes |
| Plain HTML, WordPress, Webflow, Shopify | Selector, text, styles, plus the detected CMS or builder |

### Get exact file and line on any framework

Add a dev-only inspector plugin and Pinpoint reads its attributes automatically:

- **Vite or webpack, any framework (React, Vue, Svelte, Solid, Preact, Qwik):** [code-inspector-plugin](https://github.com/zh-lx/code-inspector)
- **Vue:** `vite-plugin-vue-inspector`
- **React:** `react-dev-inspector`
- **Astro:** built in during `astro dev`
- **Rails:** set `config.action_view.annotate_rendered_view_with_filenames = true` in `development.rb`
- **Phoenix:** set `config :phoenix_live_view, debug_heex_annotations: true` in `dev.exs`
- **Drupal:** turn on Twig debug mode

## Privacy

Pinpoint makes no network requests. Notes are kept in Chrome's local extension storage and only leave your machine when you copy them.

| Permission | Why it's needed |
|------------|-----------------|
| `storage` | Save your notes per page |
| `activeTab`, `scripting` | Show the toolbar on the tab you're using |
| Access to all sites | Read framework and component info on whatever page you annotate |

## Known limits

- Closed shadow roots can't be entered, so you get the host element there.
- Solid and other frameworks that keep no link from the DOM to components show no component tree unless you add an inspector plugin.
- Iframes (for example the Storybook canvas) can't be annotated from the parent page. Open the iframe's URL directly.
- Pausing freezes CSS animations, transitions, Web Animations, video and `requestAnimationFrame` loops. Animations driven by `setTimeout` keep running.
- Chrome blocks extensions on `chrome://` pages and the Chrome Web Store.

## Project structure

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (Manifest V3) |
| `background.js` | Toolbar icon and keyboard shortcut |
| `content.js` | Toolbar, element picking, notes, markers, markdown export |
| `main.js` | Runs in the page's own JS world to detect frameworks, components, source files, templates and behaviour hooks, and to freeze animation frames |
| `website/` | Landing page |

## Contributing

Bug reports and ideas are welcome. [Open an issue](https://github.com/biratdatta/pinpoint/issues), and include the page or stack you were on if something wasn't detected correctly.

## Author

Made by **Birat Datta** · [biratdatta.tech](https://biratdatta.tech) · [birat.datta26@gmail.com](mailto:birat.datta26@gmail.com)

If Pinpoint saves you time, [buy me a coffee](https://buymeacoffee.com/biratdatta) or ⭐ the repo.
