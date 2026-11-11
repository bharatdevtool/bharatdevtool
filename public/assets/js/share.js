// share.js — "Share this tool" sheet, "shared with you" banner and post-success share prompt.
// Branding travels with shares, never inside users' files. Links are always the clean page URL
// (no ?query or #hash), so shared links never carry anyone's data.
(function () {
  if (window.BDTShare) return;

  var SITE = 'Bharat Dev Tools';
  var STYLE_ID = 'bdt-share-style';
  var ICON = {
    share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    gift: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>'
  };

  function track(event, params) {
    try { if (window.Analytics && window.Analytics.track) window.Analytics.track(event, params || {}); } catch (e) {}
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.bdt-share-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;border:1px solid rgba(100,116,139,.35);background:transparent;color:#334155;font:500 14px/1 system-ui,sans-serif;cursor:pointer}' +
      '.dark .bdt-share-btn,[data-theme=dark] .bdt-share-btn{color:#E2E8F0}' +
      '.bdt-share-btn:hover{border-color:#3B82F6;color:#3B82F6}' +
      '@media(max-width:639px){.bdt-share-label{display:none}.bdt-share-btn{padding:7px 9px}}' +
      '.bdt-sheet-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(2,6,23,.45);display:flex;align-items:flex-end;justify-content:center}' +
      '@media(min-width:640px){.bdt-sheet-backdrop{align-items:center}}' +
      '.bdt-sheet{width:100%;max-width:420px;background:#fff;color:#0F172A;border-radius:16px 16px 0 0;padding:18px;box-shadow:0 20px 50px rgba(0,0,0,.3);font:14px/1.45 system-ui,sans-serif}' +
      '@media(min-width:640px){.bdt-sheet{border-radius:16px}}' +
      '.dark .bdt-sheet{background:#0F172A;color:#E2E8F0}' +
      '.bdt-sheet h2{margin:0 0 4px;font-size:16px;font-weight:700}' +
      '.bdt-sheet p{margin:0 0 14px;color:#64748B;font-size:13px}' +
      '.bdt-sheet-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}' +
      '.bdt-sheet-grid a,.bdt-sheet-grid button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px;border-radius:12px;border:1px solid rgba(100,116,139,.25);background:transparent;color:inherit;text-decoration:none;font:500 12px system-ui,sans-serif;cursor:pointer}' +
      '.bdt-sheet-grid a:hover,.bdt-sheet-grid button:hover{border-color:#3B82F6}' +
      '.bdt-dot{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px}' +
      '.bdt-sheet-close{float:right;border:0;background:transparent;color:#64748B;cursor:pointer;padding:4px}' +
      '.bdt-banner{display:flex;align-items:center;gap:10px;justify-content:center;flex-wrap:wrap;padding:8px 14px;background:linear-gradient(90deg,rgba(16,185,129,.12),rgba(59,130,246,.12));border-bottom:1px solid rgba(59,130,246,.25);font:13px/1.4 system-ui,sans-serif}' +
      '.bdt-banner a{color:#2563EB;font-weight:600;text-decoration:none}.dark .bdt-banner a{color:#60A5FA}' +
      '.bdt-banner button{border:0;background:transparent;color:inherit;opacity:.6;cursor:pointer;padding:2px}' +
      '.bdt-prompt{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0;padding:10px 12px;border-radius:12px;border:1px solid rgba(16,185,129,.35);background:rgba(16,185,129,.07);font:13px/1.4 system-ui,sans-serif}' +
      '.bdt-prompt .bdt-grow{flex:1;min-width:180px}' +
      '.bdt-prompt a,.bdt-prompt button.bdt-act{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;font:600 12px system-ui,sans-serif;text-decoration:none;cursor:pointer;border:1px solid rgba(100,116,139,.3);background:transparent;color:inherit}' +
      '.bdt-prompt a.bdt-wa{background:#25D366;border-color:#25D366;color:#fff}' +
      '.bdt-prompt button.bdt-x{border:0;background:transparent;opacity:.6;cursor:pointer;padding:2px}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function cleanUrl() {
    return window.location.origin + window.location.pathname;
  }

  function toolName() {
    var t = (document.title || SITE).split('|')[0].replace(/[—–-]\s*Free Online Tool\s*$/i, '').replace(/^Free\s+/i, '').trim();
    return t || SITE;
  }

  function shareText() {
    return toolName() + ': free, private, no sign-up. Runs in your browser. ' + SITE;
  }

  function copy(text, btn) {
    var done = function () {
      if (btn) {
        var old = btn.getAttribute('data-label') || btn.textContent;
        btn.setAttribute('data-label', old);
        btn.querySelector('span:last-child') ? (btn.querySelector('span:last-child').textContent = 'Copied!') : (btn.textContent = 'Copied!');
        setTimeout(function () {
          btn.querySelector('span:last-child') ? (btn.querySelector('span:last-child').textContent = old) : (btn.textContent = old);
        }, 1600);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      ta.remove();
    }
  }

  function channels(url, text) {
    var u = encodeURIComponent(url);
    var t = encodeURIComponent(text);
    return [
      { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', mark: 'W', href: 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url) },
      { id: 'telegram', label: 'Telegram', color: '#229ED9', mark: 'T', href: 'https://t.me/share/url?url=' + u + '&text=' + t },
      { id: 'x', label: 'X', color: '#0F172A', mark: 'X', href: 'https://twitter.com/intent/tweet?text=' + t + '&url=' + u },
      { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', mark: 'in', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + u }
    ];
  }

  /** Open the share sheet (native share on phones first). */
  function openSheet(opts) {
    opts = opts || {};
    var url = opts.url || cleanUrl();
    var text = opts.text || shareText();
    track('share_open', { source: opts.source || 'header' });

    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && !opts.noNative) {
      navigator.share({ title: toolName(), text: text, url: url }).then(function () { track('share_channel', { channel: 'native' }); }, function () {});
      return;
    }
    injectStyle();
    var back = document.createElement('div');
    back.className = 'bdt-sheet-backdrop';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('aria-label', 'Share this tool');
    var items = channels(url, text).map(function (c) {
      return '<a href="' + c.href + '" target="_blank" rel="noopener noreferrer" data-channel="' + c.id + '"><span class="bdt-dot" style="background:' + c.color + '">' + c.mark + '</span><span>' + c.label + '</span></a>';
    }).join('');
    back.innerHTML =
      '<div class="bdt-sheet"><button class="bdt-sheet-close" aria-label="Close">' + ICON.close + '</button>' +
      '<h2>Share ' + toolName().replace(/</g, '&lt;') + '</h2>' +
      '<p>Free and private: everything runs in the browser. The link never includes your data.</p>' +
      '<div class="bdt-sheet-grid">' + items + '</div>' +
      '<div class="bdt-sheet-grid" style="grid-template-columns:1fr;margin-top:8px"><button type="button" data-copy><span>Copy link</span></button></div></div>';
    function close() { back.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    back.addEventListener('click', function (e) {
      if (e.target === back || e.target.closest('.bdt-sheet-close')) close();
      var a = e.target.closest('[data-channel]');
      if (a) { track('share_channel', { channel: a.getAttribute('data-channel') }); setTimeout(close, 100); }
      var c = e.target.closest('[data-copy]');
      if (c) { copy(url, c); track('share_channel', { channel: 'copy' }); }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    back.querySelector('a').focus();
  }

  /** A "Share" button, appended into `container`. */
  function mountButton(container, opts) {
    if (!container || container.querySelector('.bdt-share-btn')) return;
    injectStyle();
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bdt-share-btn';
    b.setAttribute('aria-label', 'Share this tool');
    b.innerHTML = ICON.share + '<span class="bdt-share-label">Share</span>';
    b.addEventListener('click', function () { openSheet(opts); });
    if (opts && opts.before) container.insertBefore(b, opts.before);
    else container.appendChild(b);
  }

  /** "Someone shared this with you" banner for people who arrive through a shared link. */
  function receivedBanner(afterEl) {
    try {
      if (sessionStorage.getItem('bdt_banner_closed')) return;
    } catch (e) {}
    injectStyle();
    var bar = document.createElement('div');
    bar.className = 'bdt-banner';
    bar.setAttribute('role', 'note');
    bar.innerHTML =
      '<span>' + ICON.gift + '</span><span>This was shared with you using <strong>' + SITE + '</strong>: 50+ free tools that run privately in your browser.</span>' +
      '<a href="/">See all tools →</a><button type="button" aria-label="Dismiss">' + ICON.close + '</button>';
    bar.querySelector('button').addEventListener('click', function () {
      bar.remove();
      try { sessionStorage.setItem('bdt_banner_closed', '1'); } catch (e) {}
    });
    if (afterEl && afterEl.parentNode) afterEl.parentNode.insertBefore(bar, afterEl.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
    track('shared_link_landing', {});
  }

  /** Small "share this tool" card after a successful result; once per page per session. */
  function successPrompt(afterEl, message) {
    if (!afterEl) return;
    var key = 'bdt_prompt_' + window.location.pathname;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch (e) {}
    injectStyle();
    var url = cleanUrl();
    var card = document.createElement('div');
    card.className = 'bdt-prompt';
    card.setAttribute('role', 'status');
    card.innerHTML =
      '<span class="bdt-grow">' + (message || 'Done! Know someone who needs this? Share it, it is free.') + '</span>' +
      '<a class="bdt-wa" href="https://wa.me/?text=' + encodeURIComponent(shareText() + ' ' + url) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' +
      '<button type="button" class="bdt-act" data-more>More…</button>' +
      '<button type="button" class="bdt-x" aria-label="Dismiss">' + ICON.close + '</button>';
    card.addEventListener('click', function (e) {
      if (e.target.closest('.bdt-wa')) track('share_channel', { channel: 'whatsapp', source: 'prompt' });
      if (e.target.closest('[data-more]')) openSheet({ source: 'prompt', noNative: false });
      if (e.target.closest('.bdt-x')) card.remove();
    });
    afterEl.parentNode.insertBefore(card, afterEl.nextSibling);
    track('share_prompt_shown', {});
  }

  window.BDTShare = { openSheet: openSheet, mountButton: mountButton, receivedBanner: receivedBanner, successPrompt: successPrompt };

  // Arrived through a shared link (data was in #… / ?… and moved to memory by the page)?
  function sharedLanding() {
    try {
      if (window.__bdtShared) return true;
      if (window.__bdtPrefill && typeof window.__bdtPrefill.keys === 'function') {
        var keys = Array.from(window.__bdtPrefill.keys()).filter(function (k) { return k !== 'debug'; });
        return keys.length > 0;
      }
    } catch (e) {}
    return false;
  }
  function boot() {
    if (sharedLanding()) receivedBanner(document.querySelector('header'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
