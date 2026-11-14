/* Malepe R&R — progressive enhancement only. Every link already works without this file. */
(function () {
  'use strict';
  var d = document;
  d.documentElement.classList.add('js');
  var NUMBER = d.body.getAttribute('data-wa-number');
  var BRAND = 'Malepe R&R';

  function waUrl(text) {
    return 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(text);
  }

  /* ---- mobile menu: close on Escape / outside tap / link tap ---- */
  var menu = d.querySelector('.menu');
  if (menu) {
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus(); // keep keyboard users in place
      }
    });
    d.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    menu.addEventListener('toggle', function () {
      d.documentElement.style.overflow = menu.open ? 'hidden' : '';
    });
  }

  /* ---- "Get a Quote" (no service chosen yet) → service picker sheet ---- */
  var sheet = d.getElementById('quote-sheet');
  if (sheet && typeof sheet.showModal === 'function') {
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-wa="general"]');
      if (!a || sheet.contains(a)) return;
      e.preventDefault();
      if (menu) menu.open = false;
      sheet.showModal();
    });
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet || e.target.closest('[data-close]')) sheet.close();
      else if (e.target.closest('a')) setTimeout(function () { sheet.close(); }, 50);
    });
  }

  /* ---- lightbox for real project photos: <a href="big.webp" data-lightbox><img …></a> ---- */
  var lbLinks = d.querySelectorAll('a[data-lightbox]');
  if (lbLinks.length && typeof HTMLDialogElement === 'function') {
    var lb = d.createElement('dialog');
    lb.className = 'sheet lb';
    lb.innerHTML = '<div class="sheet-in"><div class="sheet-head"><span class="mono"></span><button class="sheet-x" type="button" aria-label="Close">✕</button></div><img alt=""></div>';
    d.body.appendChild(lb);
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('button')) lb.close(); });
    lbLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var img = lb.querySelector('img');
        img.src = a.href;
        img.alt = (a.querySelector('img') || {}).alt || '';
        lb.querySelector('.mono').textContent = img.alt;
        lb.showModal();
      });
    });
  }

  /* ---- quote builder (/quote/) ---- */
  var form = d.getElementById('qb');
  if (!form) return;
  var send = d.getElementById('qb-send');
  var mail = d.getElementById('qb-mail');
  var copy = d.getElementById('qb-copy');
  var err = d.getElementById('qb-err');
  var groups = form.querySelectorAll('.chips[data-for]');
  var otherWrap = d.getElementById('loc-other-wrap');

  function val(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function text(id) { var el = d.getElementById(id); return el ? el.value.trim() : ''; }

  function state() {
    var loc = val('location');
    if (loc === 'Other') loc = text('loc-other') || 'Other';
    return {
      service: val('service'),
      item: val('item'),
      location: loc,
      timing: val('timing'),
      client: val('client'),
      name: text('qb-name'),
      notes: text('qb-notes')
    };
  }

  // Keep in sync with waMessage() in scripts/build.mjs (same opening line).
  function buildMessage(s) {
    var lines = ['Hi ' + BRAND + ", I'd like a quote.", '', 'QUOTE REQUEST'];
    lines.push('Service: ' + (s.service ? s.service + (s.item ? ' › ' + s.item : '') : '(not chosen)'));
    lines.push('Location: ' + (s.location || ''));
    lines.push('Timing: ' + (s.timing || ''));
    lines.push('Client: ' + (s.client || ''));
    if (s.name) lines.push('Name: ' + s.name);
    if (s.notes) lines.push('Details: ' + s.notes);
    return lines.join('\n');
  }

  function showGroups(service) {
    groups.forEach(function (g) {
      var on = g.getAttribute('data-for') === service;
      g.hidden = !on;
      if (!on) g.querySelectorAll('input:checked').forEach(function (i) { i.checked = false; });
    });
    var hint = d.getElementById('item-hint');
    if (hint) hint.hidden = !!service;
  }

  function render() {
    var s = state();
    var rows = { service: s.service ? s.service + (s.item ? ' › ' + s.item : '') : '', location: s.location, timing: s.timing, client: s.client };
    Object.keys(rows).forEach(function (k) {
      var el = d.querySelector('[data-out="' + k + '"]');
      if (!el) return;
      el.textContent = rows[k] || '—';
      el.classList.toggle('empty', !rows[k]);
    });
    if (otherWrap) otherWrap.hidden = val('location') !== 'Other';
    var msg = buildMessage(s);
    send.href = waUrl(msg);
    if (mail) {
      var to = mail.getAttribute('data-to') || '';
      mail.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Quote request — ' + (s.service || 'general')) + '&body=' + encodeURIComponent(msg);
    }
    return s;
  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'service') showGroups(e.target.value);
    err.textContent = '';
    render();
  });
  form.addEventListener('input', render);

  send.addEventListener('click', function (e) {
    var s = state();
    if (!s.service) {
      e.preventDefault();
      err.textContent = 'Choose a service first (step 01).';
      form.querySelector('input[name="service"]').focus();
    }
  });

  if (copy && navigator.clipboard) {
    copy.hidden = false;
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(buildMessage(state())).then(function () {
        copy.textContent = 'Copied ✓';
        copy.classList.add('copy-ok');
        setTimeout(function () { copy.textContent = 'Copy message'; copy.classList.remove('copy-ok'); }, 2000);
      }, function () {
        err.textContent = 'Your browser blocked copying. Use “Send on WhatsApp” or “Send by email” instead.';
      });
    });
  }

  // Pre-select from URL: /quote/?service=carpentry&item=Built-in%20cupboards
  var q = new URLSearchParams(location.search);
  var pre = (q.get('service') || '').toLowerCase();
  if (!val('service')) form.querySelectorAll('input[name="service"]').forEach(function (i) {
    if (i.value.toLowerCase() === pre) i.checked = true;
  });
  showGroups(val('service'));
  var preItem = q.get('item');
  if (preItem && !val('item')) form.querySelectorAll('input[name="item"]').forEach(function (i) {
    if (i.value === preItem && !i.closest('[hidden]')) i.checked = true;
  });
  render();

  // On Back/Forward, Chrome restores ticked choices after 'load' but before 'pageshow' (and the
  // back-forward cache restores them with persisted=true). Re-sync on every pageshow so the visible
  // job list, the preview card and the WhatsApp message always match what is ticked on screen.
  window.addEventListener('pageshow', function () { showGroups(val('service')); render(); });
})();
