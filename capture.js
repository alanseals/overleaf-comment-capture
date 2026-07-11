// Overleaf -> Claude comment capture bookmarklet (source)
// Built 2026-07-10 against the review-panel DOM verified live that day
// (classes: review-panel-entry-comment, review-panel-comment-body,
//  review-panel-entry-user, review-panel-entry-time, data-pos/data-top).
// Runs only when clicked, only in the already-open Overleaf tab.
// Reads the rendered page, downloads a JSON file, sends nothing anywhere.
(async () => {
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const panel = document.querySelector('.review-panel-container');
  if (!panel) {
    alert('Overleaf → Claude: open the Review panel first (comment icon, top right), then click the bookmarklet again.');
    return;
  }

  // 1. Expand every truncated comment ("show more"), repeating until none remain.
  for (let pass = 0; pass < 12; pass++) {
    const more = $$('.review-panel-expandable-links button', panel)
      .filter(b => /show\s*more/i.test(b.textContent));
    if (more.length === 0) break;
    more.forEach(b => b.click());
    await new Promise(r => setTimeout(r, 250));
  }

  // 2. Scrape every comment thread in the panel (first message + any replies).
  const threads = $$('.review-panel-entry-comment', panel).map(entry => {
    let messages = $$('.review-panel-comment', entry).map(c => ({
      author: (c.querySelector('.review-panel-entry-user') || {}).textContent || '',
      time: (c.querySelector('.review-panel-entry-time') || {}).textContent || '',
      text: (c.querySelector('.review-panel-comment-body') || {}).textContent || ''
    }));
    // Fallback if Overleaf ever drops the inner wrapper class:
    if (messages.length === 0) {
      messages = $$('.review-panel-comment-body', entry).map(b => ({
        author: '', time: '', text: b.textContent || ''
      }));
    }
    messages = messages
      .map(m => ({ author: m.author.trim(), time: m.time.trim(), text: m.text.trim() }))
      .filter(m => m.text);
    return {
      dataPos: Number(entry.getAttribute('data-pos')),
      dataTop: Number(entry.getAttribute('data-top')),
      messages
    };
  }).filter(t => t.messages.length > 0)
    .sort((a, b) => a.dataPos - b.dataPos);

  // 3. Also capture tracked-change text currently rendered in the editor.
  //    CodeMirror virtualizes, so this covers only lines near the viewport;
  //    the JSON flags it as partial. Full tracked changes still travel by
  //    Review > Accept, then git.
  const trackedChangesVisible = $$('.cm-content .ol-cm-change').map(s => ({
    kind: s.className.replace(/\s+/g, ' ').trim(),
    text: (s.textContent || '').trim().slice(0, 2000)
  })).filter(c => c.text);

  // 4. Identify project and file.
  const crumbs = $$('.ol-cm-breadcrumbs div');
  const file = crumbs.length ? crumbs[0].textContent.trim() : 'unknown';
  const project = (document.title || 'overleaf')
    .replace(/\s*-\s*(Online LaTeX Editor\s*)?Overleaf.*$/i, '').trim();

  const payload = {
    generator: 'overleaf-comments-bookmarklet v1.0',
    project: project,
    file: file,
    url: location.href,
    capturedAt: new Date().toISOString(),
    threadCount: threads.length,
    threads: threads,
    trackedChangesVisible: {
      note: 'partial: only editor lines rendered at capture time; for the full set, Review > Accept in Overleaf so the text syncs via git',
      items: trackedChangesVisible
    }
  };

  // 5. Download the JSON (and copy to clipboard as a fallback).
  const json = JSON.stringify(payload, null, 2);
  const slug = (project + '_' + file).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'overleaf_comments_' + slug + '_' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  let clip = '';
  try { await navigator.clipboard.writeText(json); clip = ' Also copied to clipboard.'; } catch (e) {}

  const msgCount = threads.reduce((n, t) => n + t.messages.length, 0);
  alert('Overleaf → Claude: captured ' + threads.length + ' comment threads (' +
    msgCount + ' messages) from ' + file + '.\nDownloaded ' + a.download + ' to your Downloads folder.' + clip +
    '\n\nIf a comment count looks low, scroll through the document once and click again.');
})();
