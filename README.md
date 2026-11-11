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
2. **[Karabiner-Elements](https://karabiner-elements.pqrs.org)** (free, open source) remaps
   **Ctrl+Tab** to **Ctrl+Q** (and **Ctrl+Shift+Tab** to **Ctrl+Shift+Q**), only while your
   browser is the front app. You never press Ctrl+Q yourself.

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
3. Set up the Ctrl+Tab remap:

   ```sh
   python3 karabiner/install.py
   ```

   This installs Karabiner-Elements with Homebrew if it's missing and adds the rule to your
   active Karabiner profile. Karabiner picks the change up right away. On a fresh install,
   approve the permissions Karabiner asks for (Input Monitoring and its driver extension).
   Running the command again replaces the rule rather than adding a second copy.

   The rule covers Google Chrome by default. For other Chromium browsers, pass their bundle
   IDs:

   ```sh
   osascript -e 'id of app "Brave Browser"'        # → com.brave.Browser
   python3 karabiner/install.py com.google.Chrome com.brave.Browser
   ```

   Running the command replaces the browser list, so pass every browser you use each time.
   Prisma Access Browser's bundle ID is `com.talon-sec.Work`:

   ```sh
   python3 karabiner/install.py com.google.Chrome com.talon-sec.Work
   ```

## Files

| File | Role |
|---|---|
| `background.js` | MRU ordering, cycle state, tab thumbnails, copy URL |
| `overlay.js` | In-page overlay; commits when Ctrl is released; toast |
| `ui.js` | Shared rendering for the overlay and the popup fallback |
| `switcher.html` / `switcher.js` | Popup fallback for pages that block content scripts |
| `offscreen.html` / `offscreen.js` | Clipboard writer for copy URL |
| `karabiner/install.py` | Installs Karabiner-Elements and adds the Ctrl+Tab remap for your browsers |

## License

[MIT](LICENSE)
