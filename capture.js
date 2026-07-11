// Overleaf -> Claude comment capture bookmarklet (source)  v1.1
// Built 2026-07-10, hardened 2026-07-10 after a hostile audit, against the
// review-panel DOM verified live that day (classes: review-panel-entry-comment,
// review-panel-comment-body, review-panel-entry-user, review-panel-entry-time,
// data-pos/data-top; editor breadcrumb ol-cm-breadcrumbs is file-then-section).
// Runs only when clicked, only in the already-open Overleaf tab. Reads the
// rendered page, downloads a JSON file, sends nothing anywhere.
(async () => {
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const isTruncated = (t) => /(…|\.\.\.)\s*$/.test((t || '').trim());

  const panel = document.querySelector('.review-panel-container') ||
                document.querySelector('[data-testid="review-panel"]');
  if (!panel) {
    alert('Overleaf → Claude: could not find the review panel.\n\n' +
      'Open the Review panel first (comment icon, top right), then click again.\n\n' +
      'If the Review panel IS already open and you still see this, Overleaf may have changed ' +
      'its layout since this tool was built (2026-07-10). Send Claude this exact message so it ' +
      'can update the tool.');
    return;
  }

  // 1. Expand every truncated comment. Detect truncation by a trailing ellipsis
  //    (language-independent) and click that entry's expand control at most once,
  //    so it never toggles an already-expanded comment back closed and does not
  //    depend on the button reading "show more" in English.
  const clickedEntries = new WeakSet();
  for (let pass = 0; pass < 12; pass++) {
    let clicked = 0;
    $$('.review-panel-entry-comment', panel).forEach(entry => {
      if (clickedEntries.has(entry)) return;
      const body = entry.querySelector('.review-panel-comment-body');
      if (body && isTruncated(body.textContent)) {
        const btn = entry.querySelector('.review-panel-expandable-links button');
        if (btn) { btn.click(); clickedEntries.add(entry); clicked++; }
      }
    });
    if (clicked === 0) break;
    await new Promise(r => setTimeout(r, 300));
  }

  // 2. Scrape every comment thread (first message plus any replies), in order.
  const numAttr = (el, name) => {
    const v = el.getAttribute(name);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const authorOf = (c) => {
    const el = c.querySelector('.review-panel-entry-user');
    if (!el) return '';
    const clone = el.cloneNode(true);        // strip color/initial badges so the name is clean
    clone.querySelectorAll('[class*="badge"]').forEach(b => b.remove());
    return clone.textContent.trim();
  };
  const threads = $$('.review-panel-entry-comment', panel).map(entry => {
    let comments = $$('.review-panel-comment', entry);
    // Fallback if Overleaf ever drops the inner wrapper class:
    if (comments.length === 0) comments = [entry];
    const messages = comments.map(c => {
      const bodyEl = c.querySelector('.review-panel-comment-body');
      const text = (bodyEl ? bodyEl.textContent : '').trim();
      return {
        author: authorOf(c),
        time: (c.querySelector('.review-panel-entry-time') || {}).textContent
          ? c.querySelector('.review-panel-entry-time').textContent.trim() : '',
        text: text,
        possiblyTruncated: isTruncated(text)
      };
    }).filter(m => m.text);
    return { dataPos: numAttr(entry, 'data-pos'), dataTop: numAttr(entry, 'data-top'), messages };
  }).filter(t => t.messages.length > 0)
    .sort((a, b) => (a.dataPos == null ? Infinity : a.dataPos) - (b.dataPos == null ? Infinity : b.dataPos));

  // 3. Capture tracked-change text currently rendered in the editor. CodeMirror
  //    virtualizes, so this is only the lines near the viewport; the JSON says so.
  //    The full set travels by Review > Accept in Overleaf, then git.
  const trackedChangesVisible = $$('.cm-content .ol-cm-change').map(s => ({
    kind: s.className.replace(/\s+/g, ' ').trim(),
    text: (s.textContent || '').trim().slice(0, 2000)
  })).filter(c => c.text);

  // 4. Identify project and file. The editor breadcrumb is file-first, then the
  //    section path within the file, so the filename is the first crumb.
  const crumbs = $$('.ol-cm-breadcrumbs div');
  const file = crumbs.length ? crumbs[0].textContent.trim() : 'unknown';
  const project = (document.title || 'overleaf')
    .replace(/\s*-\s*(Online LaTeX Editor\s*)?Overleaf.*$/i, '').trim() || 'overleaf';

  const msgCount = threads.reduce((n, t) => n + t.messages.length, 0);
  const truncCount = threads.reduce((n, t) => n + t.messages.filter(m => m.possiblyTruncated).length, 0);

  const payload = {
    generator: 'overleaf-comments-bookmarklet v1.1',
    project: project,
    file: file,
    url: location.href,
    capturedAt: new Date().toISOString(),
    threadCount: threads.length,
    messageCount: msgCount,
    threads: threads,
    trackedChangesVisible: {
      note: 'partial: only editor lines rendered at capture time; for the full set, Review > Accept in Overleaf so the text syncs via git',
      items: trackedChangesVisible
    }
  };

  // 5. Download the JSON (and copy to clipboard as a convenience fallback).
  const json = JSON.stringify(payload, null, 2);
  let slug = (project + '_' + file).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!slug) slug = 'overleaf';
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'overleaf_comments_' + slug + '_' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  let clip = '';
  try { await navigator.clipboard.writeText(json); clip = ' Also copied to clipboard.'; } catch (e) {}

  alert('Overleaf → Claude: captured ' + threads.length + ' comment threads (' + msgCount +
    ' messages) from ' + file + '.\nDownloaded ' + a.download + ' to your Downloads folder.' + clip +
    (truncCount ? '\n\nWARNING: ' + truncCount + ' comment(s) may still be cut off (flagged ' +
      'possiblyTruncated in the file). Open those threads fully and run again.' : '') +
    '\n\nThis captures the current file and unresolved comments only. For other files click again ' +
    'after switching; for resolved comments turn on "Show resolved comments" first.');
})();
