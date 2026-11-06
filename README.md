# MRU Tab Switcher

A most-recently-used tab switcher for Chromium-based browsers on macOS.

Hold **Ctrl**, tap **Tab** to step through your recent tabs, release **Ctrl** to switch.
A quick tap jumps straight back to the previous tab.

- A horizontal strip of tab screenshots, most recent first, capped at 7 tabs
- **Ctrl+Shift+Tab** steps backwards, **Esc** cancels, clicking a card picks that tab
- Only tabs in the current window are listed
- **⌘⇧C** copies the current tab's URL and shows a "Copied link" toast

## How it works

Chromium won't let extensions bind the Tab key, so the setup has two parts:

1. **The extension** (plain MV3, no build step) binds **Ctrl+Q** / **Ctrl+Shift+Q**. It
   orders tabs by `tab.lastAccessed`, draws the overlay inside the page, and switches tabs
   when the page sees **Ctrl** released.
2. **[BetterTouchTool](https://folivora.ai)** remaps **Ctrl+Tab** to **Ctrl+Q** (and
   **Ctrl+Shift+Tab** to **Ctrl+Shift+Q**), only while your browser is the front app. You
   never press Ctrl+Q yourself.

An extension can only screenshot the tab that's currently visible. So each tab is captured
when you switch to it, when it finishes loading, and shortly after you scroll or click in it.
Tabs that haven't been visited since the extension loaded show their favicon instead.

On pages where content scripts can't run (`chrome://` pages, the new tab page), the switcher
opens in a small popup window instead.

## Install

1. Go to `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose
   this folder.
2. Go to `chrome://extensions/shortcuts` and check that MRU Tab Switcher has **⌃Q**, **⌃⇧Q** and
   **⌘⇧C**. Set any that are missing.
3. Find your browser's bundle ID, then generate and import the BetterTouchTool preset:

   ```sh
   osascript -e 'id of app "Google Chrome"'        # → com.google.Chrome
   python3 btt/make-preset.py com.google.Chrome > btt/tab-switcher.bttpreset
   open btt/tab-switcher.bttpreset                  # imports into BetterTouchTool
   ```

## Files

| File | Role |
|---|---|
| `background.js` | MRU ordering, cycle state, tab thumbnails, copy URL |
| `overlay.js` | In-page overlay; commits when Ctrl is released; toast |
| `ui.js` | Shared rendering for the overlay and the popup fallback |
| `switcher.html` / `switcher.js` | Popup fallback for pages that block content scripts |
| `offscreen.html` / `offscreen.js` | Clipboard writer for copy URL |
| `btt/make-preset.py` | Generates the BetterTouchTool preset for a given browser |

## License

[MIT](LICENSE)
