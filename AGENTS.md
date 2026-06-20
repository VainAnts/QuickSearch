# AGENTS.md

Quick context for OpenCode agents working in this repo.

## What this is

A Manifest V3 browser extension (Chrome/Edge) that lets the user search selected
text via right-click menu or keyboard shortcut across configurable search engines.
Source files are vanilla JavaScript, HTML, and CSS. All user-facing strings and
code comments are in Simplified Chinese; preserve that convention.

## Repository layout

```
manifest.json        Manifest V3 declaration (entrypoint; load this in browser)
background.js        Service worker: context menu, search dispatch, storage sync
content.js           Runs on every page at document_end; reads selection, fires shortcuts
popup.html           Toolbar popup (settings UI)
popup.js             Popup logic: engine CRUD, drag-reorder, shortcut recording, import/export
popup.css            Popup styles
icons/icon{16,48,128}.png   Toolbar/action icons
README.md            End-user install + usage doc (Chinese)
```

There is no `package.json`, no bundler, no test runner, no linter, no formatter,
no CI workflow, and no `opencode.json`. Treat the repo as a static directory
that is loaded directly by the browser as an "unpacked extension".

## Build / test / lint

None configured. Verification is manual:

1. Open `edge://extensions/` or `chrome://extensions/`, enable Developer Mode.
2. Click "Load unpacked" and select the repo root (the directory containing
   `manifest.json`).
3. After any JS/HTML/CSS change, click the extension's "Reload" button on the
   extensions page. Service-worker changes also require reloading.
4. Smoke checks: right-click a selection (context menu), press the default
   shortcut, open the popup (add/edit/delete/reorder engines, record a
   shortcut, export + re-import config).

## Architecture notes (non-obvious)

- **Selection flow**: `background.js` does not read the DOM itself. It calls
  `chrome.tabs.sendMessage(..., {action: 'getSelection'})` to the content script,
  which returns `window.getSelection()`. Content script is injected on
  `<all_urls>` at `document_end`.
- **Shortcuts are NOT the manifest `commands` API.** `manifest.json` only
  declares `_execute_action` (opens the popup). The two user shortcuts
  (default-engine search, all-engines search) are implemented in
  `content.js` by listening to `keydown` and matching against
  `chrome.storage.local.get('shortcuts')` (storage key `'shortcuts'`,
  fields `default` and `allEngines`). They are ignored when the focus is in
  `INPUT` / `TEXTAREA` / `contentEditable` elements.
- **Storage layout** (`chrome.storage.local` unless noted):
  - `searchEngines` — array of `{id, name, urlTemplate, isDefault}`.
  - `sync_engines` — mirror of `searchEngines` written to `chrome.storage.sync`
    on every change; ignored if sync quota/auth fails (no error surfaced).
  - `shortcuts` — `{default?, allEngines?}` strings like `"Ctrl+Shift+S"`.
  The default engine list (`defaultEngines`) is duplicated identically in
  `background.js` and `popup.js`. If you change one, change the other.
- **URL templates** must contain `%s` (the consumer in `background.js`
  replaces only `%s` via `String.replace`). `popup.js` also accepts
  `{searchTerm}` and `{q}` in its `validateUrlTemplate` check, but those
  tokens are NOT actually substituted at search time — `%s` is the only
  working placeholder. Don't rely on the brace variants.
- **Context menu rebuild**: `initializeContextMenu()` runs on service-worker
  load, on `chrome.runtime.onInstalled`, and on every `searchEngines` storage
  change. It always `removeAll()` first, then recreates a parent
  `quickSearchSubmenu` plus one child per engine. Menu IDs equal
  `engine.id` — keep them unique and stable (the popup uses
  `engine_<timestamp>` for new entries).
- **`chrome.storage.onChanged` listener** is registered inside an
  `if (chrome.storage && chrome.storage.onChanged)` guard in `background.js`
  only; the `content.js` counterpart is registered unconditionally.

## Quirks / gotchas

- `manifest.json` requests the `scripting` permission and lists
  `dav.jianguoyun.com` in `host_permissions`, but the code only ever uses
  `chrome.tabs.sendMessage`. The `scripting` permission and the
  jianguoyun host entry are unused — likely leftover; do not add new
  features that depend on them without a real reason.
- README.md describes icons as SVG, but the actual files in `icons/` are
  `icon16.png`, `icon48.png`, `icon128.png` and the manifest references
  those PNGs. The README is the stale one.
- The popup's help text hard-codes `Ctrl+Shift+S` as the example shortcut,
  but no default is actually written to storage. The user must record one
  before the keyboard shortcut will fire.
- `content.js` wraps its `chrome.runtime.sendMessage` call in a
  `try/catch` for "extension context invalidated" — preserve that pattern
  on any new messaging from the content script.
- `background.js` logs a lot via `console.log` prefixed with `[QuickSearch]`.
  Don't strip them; they are useful when debugging context-menu races.
- `.git` is present but there is no `.gitignore`. `node_modules` and the like
  won't appear here because there is no Node toolchain — don't add a
  `.gitignore` speculatively.

## Editing conventions

- Match existing style: 2-space indent in JS/HTML/CSS, single quotes for JS
  strings, semicolons required.
- Keep `defaultEngines` arrays in `background.js` and `popup.js` in sync.
- Keep Chinese for any new user-visible strings or code comments.
- After editing `manifest.json`, fully remove and re-add the extension in the
  browser (Reload is not always enough for permission/host changes).
