// Overleaf -> Claude comment capture bookmarklet (source)  v1.6
// Built 2026-07-10, hardened 2026-07-10 after a hostile audit, against the
// review-panel DOM verified live that day (classes: review-panel-entry-comment,
// review-panel-comment-body, review-panel-entry-user, review-panel-entry-time,
// data-pos/data-top; editor breadcrumb ol-cm-breadcrumbs is file-then-section).
// v1.2 (2026-07-14): sweep the editor top to bottom before scraping. The review
// panel virtualizes -- it only renders the comment entries and tracked-change
// spans whose anchor line is near the current viewport, so a single snapshot from
// the top of a long file captured only the first screen's comments. v1.2 scrolls
// the document in steps, collects at each stop, de-duplicates entries by their
// data-pos anchor, and restores the original scroll position. If the scroller is
// not found it falls back to a single snapshot, never worse than before.
// v1.3 (2026-07-14): defend against Overleaf's 2026 editor redesign (file tabs,
// simplified toolbar, Review moved to the left sidebar): filename fallback chain,
// fileSource + selectorHealth in the payload, parse-failure warnings.
// v1.4 (2026-07-14): built on a live v1.3 capture of the redesigned editor.
// Evidence: the breadcrumb is gone (breadcrumbs:false), file tabs exist as
// [role="tab"][aria-selected="true"], and a tab's textContent concatenates
// Material-icon ligature text and bidi format chars around the real name
// ("description" + U+200E + "manuscript.tex" + "close"). v1.4 cleans tab labels
// (drops icon/close elements, treats format chars as separators, extracts the
// token bearing a known extension) and iterates every file tab in the editor's
// tab strip, capturing each open file in one click. If tab switching does not
// take effect the iteration aborts safely and the current file is captured alone.
// v1.5 (2026-07-20): stop de-duplicating comment threads by the data-pos anchor
// alone. Overleaf's latest editor returns data-pos=0 for every review-panel
// entry, so the old anchor key collapsed all comments in a file onto one bucket
// ('p0') and kept only the longest-text one, silently dropping the rest. The key
// now combines the anchor (when it still varies it disambiguates; a constant 0
// does no harm) with the ROOT comment's author, time, and FULL normalized text.
// Full text, not a prefix, means two distinct comments never share a key, so a
// distinct comment is never silently dropped. Keying on the root message only,
// not its replies, keeps the key stable when a reply loads on a later scroll
// stop. Same-key entries are the same comment re-rendered and are merged, keeping
// the most complete render. The expand loop re-checks truncation on every pass so
// a body is captured in full before it is scraped, not left half-open.
// v1.6 (2026-07-20): de-duplicate comments ACROSS files, not just within one.
// The current editor's review panel is not always file-scoped: switching to a
// file tab that has no comments of its own leaves the panel showing the previous
// file's comments, so multi-tab capture billed the same comments to every file
// (observed: main.tex's 8 comments copied onto references.bib, threadCount 16 for
// 8 real comments). A comment anchors to exactly one file, so the first file to
// surface a given comment now owns it; a later file that only re-shows already
// seen comments yields none and is marked panelUnchanged. Tracked changes come
// from the editor body, which does re-scope on tab switch, so they are untouched.
// Runs only when clicked, only in the already-open Overleaf tab. Reads the
// rendered page, downloads a JSON file, sends nothing anywhere.
(async () => {
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const isTruncated = (t) => /(…|\.\.\.)\s*$/.test((t || '').trim());
  const numAttr = (el, name) => {
    const v = el.getAttribute(name);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const panel = document.querySelector('.review-panel-container') ||
                document.querySelector('[data-testid="review-panel"]');
  if (!panel) {
    alert('Overleaf → Claude: could not find the review panel.\n\n' +
      'Open the Review panel first (the Review icon in the left sidebar), then click again.\n\n' +
      'If the Review panel IS already open and you still see this, Overleaf may have changed ' +
      'its layout since this tool was built (v1.6, 2026-07-20). Send Claude this exact message ' +
      'so it can update the tool.');
    return;
  }

  // Small on-screen note, because the sweep takes a few seconds and should not
  // look like the click did nothing.
  const hud = document.createElement('div');
  hud.textContent = 'Overleaf → Claude: capturing comments…';
  hud.style.cssText = 'position:fixed;z-index:2147483647;bottom:16px;right:16px;background:#138a07;' +
    'color:#fff;padding:8px 12px;border-radius:8px;font:600 13px -apple-system,sans-serif;' +
    'box-shadow:0 2px 8px rgba(0,0,0,.3)';
  document.body.appendChild(hud);

  const authorOf = (c) => {
    const el = c.querySelector('.review-panel-entry-user');
    if (!el) return '';
    const clone = el.cloneNode(true);        // strip color/initial badges so the name is clean
    clone.querySelectorAll('[class*="badge"]').forEach(b => b.remove());
    return clone.textContent.trim();
  };
  const scrapeThread = (entry) => {
    let comments = $$('.review-panel-comment', entry);
    if (comments.length === 0) comments = [entry];   // fallback if inner wrapper class is gone
    const messages = comments.map(c => {
      const bodyEl = c.querySelector('.review-panel-comment-body');
      const text = (bodyEl ? bodyEl.textContent : '').trim();
      const timeEl = c.querySelector('.review-panel-entry-time');
      return {
        author: authorOf(c),
        time: timeEl ? timeEl.textContent.trim() : '',
        text: text,
        possiblyTruncated: isTruncated(text)
      };
    }).filter(m => m.text);
    return { dataPos: numAttr(entry, 'data-pos'), dataTop: numAttr(entry, 'data-top'), messages };
  };
  const threadTextLen = (t) => t.messages.reduce((n, m) => n + m.text.length, 0);
  // Root-comment signature used for de-duplication. The data-pos anchor is no
  // longer trustworthy on its own (the current editor reports 0 for every entry),
  // so identity comes from the ROOT message's author, time, and FULL normalized
  // text. Full text, not a prefix, guarantees distinct comments get distinct keys
  // so none is silently dropped; root-only means a reply rendering on a later
  // scroll stop does not fork the key.
  const normText = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const rootSig = (t) => {
    const m = t.messages[0] || {};
    return normText(m.author) + '\u0001' + normText(m.time) + '\u0001' + normText(m.text);
  };

  // Accumulators keyed by a stable identity so re-rendered entries de-duplicate.
  // Cleared between files when iterating tabs.
  const threadMap = new Map();   // key: anchor+root-content -> most complete render
  const changeMap = new Map();   // key: kind + text -> tracked-change span
  const clickAttempts = new WeakMap();   // entry -> times its "show more" was clicked
  // Entries that rendered with text but yielded no parsable message: the signature
  // of Overleaf renaming an inner class (2026 redesign churn). Keyed by anchor.
  const unparsed = new Set();
  // Root signatures already attributed to a file. NOT cleared between files, so a
  // project-wide panel (or a tab switch that does not re-scope the panel) cannot
  // bill the same comment to two files: the first file to surface it owns it.
  const seenSig = new Set();

  // Collect whatever the review panel and editor render right now, expanding any
  // truncated comment first. Called at every scroll stop; the maps de-duplicate.
  const collect = async () => {
    for (let pass = 0; pass < 12; pass++) {
      let clicked = 0;
      $$('.review-panel-entry-comment', panel).forEach(entry => {
        const body = entry.querySelector('.review-panel-comment-body');
        if (!(body && isTruncated(body.textContent))) return;   // re-checked every pass
        const tries = clickAttempts.get(entry) || 0;
        if (tries >= 3) return;                                  // stop nagging a stuck entry
        const btn = entry.querySelector('.review-panel-expandable-links button');
        if (btn) { btn.click(); clickAttempts.set(entry, tries + 1); clicked++; }
      });
      if (clicked === 0) break;
      await sleep(400);
    }
    $$('.review-panel-entry-comment', panel).forEach(entry => {
      const t = scrapeThread(entry);
      if (!t.messages.length) {
        if ((entry.textContent || '').trim()) {
          unparsed.add('p' + t.dataPos + 't' + t.dataTop + 'n' + (entry.textContent || '').trim().slice(0, 40));
        }
        return;
      }
      const key = 'p' + (t.dataPos == null ? 'n' : t.dataPos) + '\u0000' + rootSig(t);
      const prev = threadMap.get(key);
      // Distinct comments get distinct keys, so this only merges the same comment
      // re-rendered; keep the most complete render (most messages, then longest).
      const better = !prev || t.messages.length > prev.messages.length ||
        (t.messages.length === prev.messages.length && threadTextLen(t) > threadTextLen(prev));
      if (better) threadMap.set(key, t);
    });
    $$('.cm-content .ol-cm-change').forEach(s => {
      const text = (s.textContent || '').trim().slice(0, 2000);
      if (!text) return;
      const kind = s.className.replace(/\s+/g, ' ').trim();
      const key = kind + '\u0000' + text;
      if (!changeMap.has(key)) changeMap.set(key, { kind, text });
    });
  };

  // Scroll a scrollable element from top to bottom, running collect() at each
  // stop so virtualized entries render and get captured. Restores scroll after.
  // No-ops to a single collect() if the element is missing or does not scroll.
  const sweep = async (el) => {
    if (!el || el.scrollHeight <= el.clientHeight + 4) { await collect(); return; }
    const original = el.scrollTop;
    const step = Math.max(200, Math.floor(el.clientHeight * 0.8));
    let pos = 0, guard = 0;
    for (;;) {
      el.scrollTop = pos;
      await sleep(250);
      await collect();
      if (pos >= el.scrollHeight - el.clientHeight || ++guard > 600) break;
      pos += step;
    }
    el.scrollTop = original;
    await sleep(150);
  };

  // --- Filename hygiene, calibrated against a live 2026-07-14 capture. A file
  // tab's raw textContent was "description<U+200E>manuscript_6_14_2026.texclose":
  // Material-icon ligature text before, the close button's ligature after, and a
  // bidi mark gluing them on. cleanLabel drops icon/button elements from a clone
  // and turns Unicode format chars into spaces so the filename stays its own
  // token; fileFromLabel then extracts the token bearing a known extension and
  // trims anything welded after it.
  const FILE_EXT = '\\.(?:tex|bib|bst|sty|cls|txt|md|markdown|csv|tsv|dat|png|jpeg|jpg|pdf|eps|svg|gif|log|do|py|rmd|rnw|json|yml|yaml|r)';
  const cleanLabel = (el) => {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('button, [role="button"], [aria-hidden="true"], svg, i, ' +
      '[class*="icon"], [class*="symbol"], [class*="close"]').forEach(n => n.remove());
    return clone.textContent.replace(/[\u200B-\u200F\u2060\uFEFF]/g, ' ').trim();
  };
  const fileFromLabel = (label) => {
    const toks = (label || '').split(/[\s/\\]+/).filter(Boolean);
    const strict = new RegExp(FILE_EXT + '(?![A-Za-z0-9])', 'i');   // extension at a boundary
    const loose = new RegExp(FILE_EXT, 'i');                        // extension welded to junk
    for (const re of [strict, loose]) {
      for (const tok of toks) {
        const m = tok.match(re);
        if (m) return tok.slice(0, m.index + m[0].length);
      }
    }
    return '';
  };

  // Identify the open file. The pre-redesign breadcrumb (file-first, then the
  // section path) still wins when present; the selected editor tab and the
  // file-tree selection are the redesign-era fallbacks.
  const resolveFile = () => {
    const crumbs = $$('.ol-cm-breadcrumbs div');
    if (crumbs.length && crumbs[0].textContent.trim()) {
      return { file: crumbs[0].textContent.trim(), fileSource: 'breadcrumbs', breadcrumbs: true };
    }
    const tabEl = $$('[role="tab"][aria-selected="true"]').find(t => fileFromLabel(cleanLabel(t)));
    if (tabEl) return { file: fileFromLabel(cleanLabel(tabEl)), fileSource: 'editor-tab', breadcrumbs: false };
    const treeFile = $$('.file-tree [aria-selected="true"], .file-tree .selected')
      .map(t => fileFromLabel(cleanLabel(t))).find(Boolean);
    if (treeFile) return { file: treeFile, fileSource: 'file-tree', breadcrumbs: false };
    return { file: 'unknown', fileSource: 'none', breadcrumbs: false };
  };

  // Sweep and scrape the file that is open right now.
  const captureCurrentFile = async () => {
    threadMap.clear(); changeMap.clear(); unparsed.clear();
    const scroller = document.querySelector('.cm-scroller');
    await sweep(scroller);
    // Belt and suspenders: if the review panel scrolls on its own (e.g. an
    // Overview layout), sweep it too. sweep() no-ops when it does not scroll,
    // and the maps make the overlap harmless.
    if (panel !== scroller) await sweep(panel);
    const scraped = Array.from(threadMap.values())
      .sort((a, b) => (a.dataPos == null ? Infinity : a.dataPos) - (b.dataPos == null ? Infinity : b.dataPos));
    // Cross-file de-duplication: keep only comments not already attributed to an
    // earlier file. When the panel is project-wide, or a tab switch did not change
    // it, every comment here is already claimed and this file yields none.
    const threads = [];
    let duplicatesDropped = 0;
    for (const t of scraped) {
      const sig = rootSig(t);
      if (seenSig.has(sig)) { duplicatesDropped++; continue; }
      seenSig.add(sig);
      threads.push(t);
    }
    const panelUnchanged = scraped.length > 0 && threads.length === 0;
    const id = resolveFile();
    return {
      file: id.file,
      fileSource: id.fileSource,
      threadCount: threads.length,
      messageCount: threads.reduce((n, t) => n + t.messages.length, 0),
      truncatedCount: threads.reduce((n, t) => n + t.messages.filter(m => m.possiblyTruncated).length, 0),
      panelUnchanged: panelUnchanged,
      selectorHealth: {
        breadcrumbs: id.breadcrumbs,
        editorScroller: !!scroller,
        threadsParsed: threads.length,
        duplicatesDropped: duplicatesDropped,
        entriesUnparsed: unparsed.size
      },
      threads: threads,
      trackedChanges: Array.from(changeMap.values())
    };
  };

  // The editor's file-tab strip: every [role=tab] whose cleaned label carries a
  // filename, restricted to the tablist holding the selected file tab so the
  // review panel's own "Current file"/"Overview" tabs never qualify.
  const fileTabs = () => {
    const tabs = $$('[role="tab"]').filter(t => fileFromLabel(cleanLabel(t)));
    if (!tabs.length) return [];
    const anchor = tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0];
    const list = anchor.closest('[role="tablist"]');
    return list ? tabs.filter(t => t.closest('[role="tablist"]') === list) : tabs;
  };

  // Click a tab and wait for the selection to actually move. Returns false if
  // it never does, so the caller can stop iterating instead of re-capturing the
  // same file under different names.
  const selectTab = async (tab) => {
    if (tab.getAttribute('aria-selected') === 'true') return true;
    tab.click();
    for (let i = 0; i < 20; i++) {
      await sleep(150);
      if (tab.getAttribute('aria-selected') === 'true') {
        await sleep(700);   // let the editor swap documents and the panel re-anchor
        return true;
      }
    }
    return false;
  };

  const tabs = fileTabs();
  const files = [];
  let tabIteration = tabs.length > 1 ? 'full' : 'single';
  if (tabs.length > 1) {
    const original = tabs.find(t => t.getAttribute('aria-selected') === 'true');
    for (const tab of tabs) {
      if (!(await selectTab(tab))) { tabIteration = 'aborted'; break; }
      hud.textContent = 'Overleaf → Claude: capturing ' + (fileFromLabel(cleanLabel(tab)) || 'file') + '…';
      files.push(await captureCurrentFile());
    }
    if (original) await selectTab(original);   // put the user back where they were
  }
  if (!files.length) files.push(await captureCurrentFile());

  const project = (document.title || 'overleaf')
    .replace(/\s*-\s*(Online LaTeX Editor\s*)?Overleaf.*$/i, '').trim() || 'overleaf';
  const totals = files.reduce((s, f) => ({
    threads: s.threads + f.threadCount,
    msgs: s.msgs + f.messageCount,
    trunc: s.trunc + f.truncatedCount,
    unparsed: s.unparsed + f.selectorHealth.entriesUnparsed
  }), { threads: 0, msgs: 0, trunc: 0, unparsed: 0 });
  const unnamed = files.filter(f => f.fileSource === 'none').length;

  const payload = {
    generator: 'overleaf-comments-bookmarklet v1.6',
    project: project,
    url: location.href,
    capturedAt: new Date().toISOString(),
    fileCount: files.length,
    tabIteration: tabIteration,   // 'full' = every open tab, 'single' = one tab open or no tab strip found, 'aborted' = a tab refused to switch
    threadCount: totals.threads,
    messageCount: totals.msgs,
    trackedChangesNote: 'swept top-to-bottom per file; for the authoritative set, Review > Accept in Overleaf so the text syncs via git',
    files: files
  };

  // Download the JSON (and copy to clipboard as a convenience fallback).
  const json = JSON.stringify(payload, null, 2);
  const fileTag = files.length === 1 ? files[0].file : files.length + '_files';
  let slug = (project + '_' + fileTag).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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

  hud.remove();
  const perFile = files.map(f => '  ' + f.file + ': ' + f.threadCount + ' thread' +
    (f.threadCount === 1 ? '' : 's') + ' (' + f.messageCount + ' message' +
    (f.messageCount === 1 ? '' : 's') + ')' +
    (f.panelUnchanged ? ' [no comments unique to this file]' : '')).join('\n');
  const deduped = files.reduce((n, f) => n + f.selectorHealth.duplicatesDropped, 0);
  alert('Overleaf → Claude: captured ' + files.length + ' file' + (files.length === 1 ? '' : 's') +
    ', ' + totals.threads + ' comment threads (' + totals.msgs + ' messages).\n' + perFile +
    '\nDownloaded ' + a.download + ' to your Downloads folder.' + clip +
    (tabIteration === 'aborted' ? '\n\nWARNING: could not switch between file tabs, so only the ' +
      'files listed above were captured. Open the missing file and click again.' : '') +
    (totals.trunc ? '\n\nWARNING: ' + totals.trunc + ' comment(s) may still be cut off (flagged ' +
      'possiblyTruncated in the file). Open those threads fully and run again.' : '') +
    (totals.unparsed ? '\n\nWARNING: ' + totals.unparsed + ' comment entr' + (totals.unparsed === 1 ? 'y' : 'ies') +
      ' rendered but could not be parsed. Overleaf has likely changed its comment markup since this ' +
      'build (v1.6, 2026-07-20). Send Claude this message so it can update the tool.' : '') +
    (unnamed ? '\n\nNOTE: ' + unnamed + ' capture(s) have file "unknown" because no filename source ' +
      '(breadcrumb, tab, file tree) resolved. The comments themselves are still captured.' : '') +
    (deduped ? '\n\nNOTE: ' + deduped + ' comment(s) that the panel showed under more than one file ' +
      'were counted once, under the first file that carried them, so each comment appears under a ' +
      'single file above.' : '') +
    '\n\nThis captures open tabs and unresolved comments only. For files not open in a tab, open them ' +
    'and click again; for resolved comments turn on "Show resolved comments" first.');
})();
