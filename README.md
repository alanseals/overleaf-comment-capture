# Overleaf Comment Capture

A one-click bookmarklet that exports the review-panel **comments** (and any visible
tracked changes) from an open Overleaf project to a local JSON file, so a coding
agent or a script can read reviewer feedback that Overleaf's Git integration does
not carry.

## Why

Overleaf stores comments and tracked changes in its own database, not in the
`.tex` source. A `git pull` from Overleaf returns only the LaTeX, so review-panel
comments never reach a local clone. The official docs even warn that Git sync can
*lose* comments and tracked changes. There is no public Overleaf API for them.

This tool reads what is already rendered in your own logged-in browser tab and
writes it to a file. It needs no session cookie, no API token, and no account
credential, and it sends nothing to any server.

## Install

You need the button on a real page in your browser, not GitHub's source view.

**Easiest:** open the hosted installer at
**https://alanseals.github.io/overleaf-comment-capture/install.html** and drag the
green **Overleaf → Claude** button to your bookmarks bar.

**Or locally:** click the green **Code** button on this repo, **Download ZIP**, unzip,
then double-click `install.html` to open it in your browser and drag the button.
Do not open `install.html` from GitHub's file viewer, that shows the code, not the page.

If you do not see a bookmarks bar under the address bar, press **Cmd+Shift+B** (Mac)
or **Ctrl+Shift+B** (Windows/Linux) to show it first. If your browser refuses to
keep a `javascript:` bookmark, the installer page also has the script ready to paste
into the DevTools Console (F12); Chrome may ask you to type `allow pasting` first.

## Use

1. Open the Overleaf project and open the **Review** panel (the comment icon, top right).
   The comments must be visible on the page, this is what a plain "Save page" misses.
2. Click the bookmark.
3. It scrolls the file top to bottom, expands every "show more", collects each comment
   (author, timestamp, full untruncated text, and its `data-pos` anchor), grabs the
   tracked-change spans, and downloads `overleaf_comments_<project>_<date>.json`. A green
   note in the corner shows it is working, and your scroll position is restored at the end.

The downloaded file is plain JSON. If you use Claude Code, tell it "done" and it reads
the file from your Downloads folder. Otherwise open it in any text editor, or point any
script or LLM at the path.

If clicking gives "could not find the review panel" while the panel is open, Overleaf's
layout has changed since this build; send that message to the maintainer to get the
selectors patched.

## Output

```json
{
  "generator": "overleaf-comments-bookmarklet v1.2",
  "project": "My_Paper",
  "file": "main.tex",
  "url": "https://www.overleaf.com/project/<id>",
  "capturedAt": "2026-07-11T02:25:38.396Z",
  "threadCount": 13,
  "messageCount": 13,
  "threads": [
    { "dataPos": 2755, "dataTop": 1637, "messages": [
        { "author": "Jane Doe", "time": "10 July, 7:53 am",
          "text": "...", "possiblyTruncated": false } ] }
  ],
  "trackedChanges": { "note": "swept top-to-bottom ...", "items": [ ] }
}
```

## Limitations

- **Whole file, but one file at a time.** The review panel virtualizes: it only renders
  the comment entries and tracked-change spans whose anchor line is near the viewport.
  As of v1.2 the tool scrolls the open file top to bottom and de-duplicates by anchor, so
  it captures every comment in that file rather than only the first screen. Tracked changes
  are swept the same way; for the authoritative set you can still use **Review → Accept** in
  Overleaf, which lands the text in the source where Git can sync it.
- **Unresolved comments only.** Resolved comments are excluded unless you turn on
  **Show resolved comments** (the inbox icon in the Review panel header) before capturing.
- **Current file, current-file tab only.** It captures the file you have open and the
  "Current file" tab, not the "Overview" tab and not other files. For a multi-file
  project, click again after switching files.
- **DOM-dependent.** It targets Overleaf's current review-panel class names
  (`review-panel-entry-comment`, `review-panel-comment-body`, ...). If Overleaf
  redesigns the panel, `capture.js` needs a small patch and `install.html` a regenerate.
- **`data-pos` indexes the live edited document**, which may hold tracked changes
  the Git clone lacks, so map comments to source by content, not by offset alone.

## Safety

Runs only when clicked, only in the tab you already have open, reads only what is on
the page, downloads locally, transmits nothing, and stores no credential.

## Developing

`capture.js` is the single source. `install.html` embeds it twice, once as the encoded
`javascript:` bookmarklet and once as a plain console block, so never hand-edit those.
After changing `capture.js`, run `node build.js` to regenerate `install.html`; the build
also serves the GitHub Pages installer.

## Credit

The DOM-parsing approach follows
[`adakite/extract-overleaf-comments`](https://github.com/adakite/extract-overleaf-comments),
which extracts the same comment nodes from a saved page. This tool does it live and
in one click, with auto-expansion of truncated threads.

## License

MIT
