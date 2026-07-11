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

Open [`install.html`](install.html) in your browser and drag the **Overleaf → Claude**
button to your bookmarks bar. That is the whole install.

If your browser blocks `javascript:` bookmarks, the same page has the script ready
to paste into the DevTools Console (F12) instead.

## Use

1. Open the Overleaf project and open the **Review** panel (comment icon, top right).
2. Click the bookmark.
3. It expands every "show more", collects each comment (author, timestamp, full
   untruncated text, and its `data-pos` anchor), grabs any tracked-change spans
   currently rendered, and downloads `overleaf_comments_<project>_<date>.json`.

Capture one file at a time (click again after switching files). Resolved comments
stay hidden unless you unhide them in Overleaf first.

## Output

```json
{
  "project": "My_Paper",
  "file": "main.tex",
  "threadCount": 13,
  "threads": [
    { "dataPos": 2755, "messages": [
        { "author": "Jane Doe", "time": "10 July, 7:53 am", "text": "..." } ] }
  ],
  "trackedChangesVisible": { "note": "partial ...", "items": [ ... ] }
}
```

## Limitations

- **Comments, not the full tracked-change set.** CodeMirror only renders lines near
  the viewport, so tracked-change capture is partial. For the complete set, use
  **Review → Accept** in Overleaf, which lands the text in the source where Git can
  sync it.
- **DOM-dependent.** It targets Overleaf's current review-panel class names
  (`review-panel-entry-comment`, `review-panel-comment-body`, ...). If Overleaf
  redesigns the panel, `capture.js` needs a small patch and `install.html` a
  regenerate.
- **`data-pos` indexes the live edited document**, which may hold tracked changes
  the Git clone lacks, so map comments to source by content, not by offset alone.

## Safety

Runs only when clicked, only in the tab you already have open, reads only what is on
the page, downloads locally, transmits nothing, and stores no credential.

## Credit

The DOM-parsing approach follows
[`adakite/extract-overleaf-comments`](https://github.com/adakite/extract-overleaf-comments),
which extracts the same comment nodes from a saved page. This tool does it live and
in one click, with auto-expansion of truncated threads.

## License

MIT
