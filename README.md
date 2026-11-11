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
2. **A key remapper** turns **Ctrl+Tab** into **Ctrl+Q** (and **Ctrl+Shift+Tab** into
   **Ctrl+Shift+Q**), only while your browser is the front app. You never press Ctrl+Q
   yourself. One installer sets up either remapper:
   - **[Karabiner-Elements](https://karabiner-elements.pqrs.org)** (free, open source), the
     default
   - **[BetterTouchTool](https://folivora.ai)** (paid), if you already use it

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
3. Set up the Ctrl+Tab remap, passing the bundle ID of every browser you use:

   ```sh
   python3 remap/install.py \
     $(osascript -e 'id of app "Google Chrome"') \
     $(osascript -e 'id of app "Prisma Access Browser"')
   ```

   `osascript -e 'id of app "<name>"'` prints an app's bundle ID, so add one
   `$(osascript ...)` per browser, using the name shown in `/Applications`. With no browsers
   given, the remap covers Google Chrome only. Each run replaces the browser list, so list
   every browser each time.

   The installer then asks which remapper to use:

   ```text
   Which key remapper should turn Ctrl+Tab into Ctrl+Q?
     1) Karabiner-Elements (free)
     2) BetterTouchTool (paid)
   Choose [1]:
   ```

   Press Enter for Karabiner-Elements, or type `2` for BetterTouchTool. To skip the question
   (in a script, say), pass `--with karabiner` or `--with btt`.

   The installer installs the chosen app with Homebrew if it's missing. On a fresh install,
   approve the permissions the app asks for (for Karabiner, Input Monitoring and its driver
   extension), or the remap won't work.

   - **Karabiner-Elements**: the rule goes straight into your active Karabiner profile and
     takes effect right away. Running the command again replaces the rule rather than adding
     a second copy.
   - **BetterTouchTool**: the installer generates a preset and opens it in BetterTouchTool.
     Confirm the import to turn the remap on.

   Use one remapper, not both. If you switch, remove the old one's rule or preset by hand.

## Files

| File | Role |
|---|---|
| `background.js` | MRU ordering, cycle state, tab thumbnails, copy URL |
| `overlay.js` | In-page overlay; commits when Ctrl is released; toast |
| `ui.js` | Shared rendering for the overlay and the popup fallback |
| `switcher.html` / `switcher.js` | Popup fallback for pages that block content scripts |
| `offscreen.html` / `offscreen.js` | Clipboard writer for copy URL |
| `remap/install.py` | Installer: sets up the Ctrl+Tab remap with the chosen remapper |
| `remap/karabiner.py` | Karabiner-Elements remapper: writes the rule into `karabiner.json` |
| `remap/btt.py` | BetterTouchTool remapper: builds and imports the preset |
| `remap/apps.py` | Installs a missing remapper app with Homebrew |

Run the installer's tests with `python3 -m unittest discover remap`.

## License

[MIT](LICENSE)
