// Regenerate install.html from capture.js. Run: node build.js
// Keeps the draggable bookmarklet and the copy-paste console block byte-for-byte
// in sync with the source, so capture.js is the single place to edit.
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const src = fs.readFileSync(path.join(dir, 'capture.js'), 'utf8');

const href = 'javascript:' + encodeURIComponent(src);
const escaped = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Overleaf → Claude: comment capture</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 720px; margin: 3rem auto; line-height: 1.5; padding: 0 1rem; }
  .bml { display: inline-block; padding: .6rem 1.2rem; background: #138a07; color: #fff; border-radius: 8px;
         text-decoration: none; font-weight: 600; font-size: 1.05rem; }
  ol li { margin: .5rem 0; }
  textarea { width: 100%; height: 8rem; font-family: monospace; font-size: .75rem; }
  .note { background: #f6f6ef; border-left: 4px solid #ccc; padding: .6rem .9rem; }
  kbd { background:#eee; border:1px solid #ccc; border-radius:4px; padding:0 .3rem; font-size:.85em; }
</style>
</head>
<body>
<h1>Overleaf → Claude</h1>
<p>Drag this button to your bookmarks bar (one time only):</p>
<p><a class="bml" href="${href}">Overleaf → Claude</a></p>
<p class="note">Don't see a bookmarks bar under the address bar? Press <kbd>Cmd+Shift+B</kbd> (Mac)
or <kbd>Ctrl+Shift+B</kbd> (Windows/Linux) to show it, then drag.</p>
<h2>Each time you want Claude to read comments</h2>
<ol>
  <li>Open the Overleaf project and open the <b>Review</b> panel (the Review icon in the
      left sidebar) so the comments are visible on the page. Open a tab for each file you
      want captured.</li>
  <li>Click the <b>Overleaf → Claude</b> bookmark.</li>
  <li>It visits every open file tab, scrolls each file top to bottom, expands every "show more",
      captures all comments plus tracked changes, and downloads
      <code>overleaf_comments_&lt;project&gt;_&lt;date&gt;.json</code> to Downloads. A green note in
      the corner names the file it is working on; you are returned to the tab you started on.</li>
  <li>Using Claude Code? Say "done" and Claude reads the file from Downloads. Otherwise the file
      is plain JSON, open it in any editor or point any script or LLM at it.</li>
</ol>
<div class="note">
<p><b>Limits.</b> Captures open editor tabs only, a file without a tab is skipped, so open a tab per
file first. Resolved comments are excluded unless you turn on <b>Show resolved comments</b> (inbox
icon in the Review panel header) first. Comments and tracked changes are swept across each whole
file; for the authoritative tracked-change set you can still use <b>Review → Accept</b> in Overleaf,
which syncs the text through git. If a comment is flagged <code>possiblyTruncated</code> in the file,
open that thread fully and run again. Overleaf is rolling out an editor redesign (tabs, simplified
toolbar), so the bookmarklet checks its own selectors: if comments render but cannot be parsed, the
filename cannot be found, or a tab refuses to switch, the finish alert says so. When you see such a
warning, ask Claude to patch the tool.</p>
<p><b>Safety.</b> Runs only when clicked, only in your open tab, reads only what is on the page,
downloads locally, sends nothing anywhere, stores no credential.</p>
</div>
<h2>Fallback if the bookmark does nothing</h2>
<p>Some browser setups block <code>javascript:</code> bookmarks. Then paste the script below into
the DevTools <b>Console</b> (F12) on the Overleaf tab and press Enter. Chrome may ask you to type
<code>allow pasting</code> first.</p>
<textarea readonly>${escaped}</textarea>
</body>
</html>
`;

fs.writeFileSync(path.join(dir, 'install.html'), html);
console.log('Wrote install.html (' + html.length + ' bytes); bookmarklet href ' + href.length + ' chars.');
