/* Malepe R&R — progressive enhancement only. Every link already works without this file. */
(function () {
  'use strict';
  var d = document;
  var root = d.documentElement;
  root.classList.add('js');

  var clamp = function (v, lo, hi) { return Math.max(lo === undefined ? 0 : lo, Math.min(hi === undefined ? 1 : hi, v)); };
  var head = d.querySelector('.site-head');

  /* ======================================================================
     MOTION ENGINE (vanilla, ~2 KB gz). Only runs when the visitor has not asked for reduced motion.
     Three relationships between scroll and animation:
       triggered : fires once as an element arrives (reveals, ripple stagger)
       scrubbed  : progress 0..1 written to a CSS variable (--p); CSS decides what that means
       pinned    : a tall wrapper holds a sticky scene; progress = how far through the wrapper we are
     No smooth-scroll hijacking: native scrolling is never replaced or delayed.
     ====================================================================== */
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still && 'IntersectionObserver' in window) {
    root.classList.add('motion');
    var vw = window.innerWidth, vh = window.innerHeight;

    /* -- triggered reveals; items marked .stg ripple outward from the middle of the screen -- */
    d.querySelectorAll('.proj-grid > .proj, .board > .swatch, .facts > .fact, .stages > li, .principles > li, .channels > .channel, .verify > a, .index > li, .index > a').forEach(function (el) { el.classList.add('stg'); });
    var reveal = new IntersectionObserver(function (entries) {
      var hit = entries.filter(function (e) { return e.isIntersecting; });
      var mid = vw / 2;
      hit.sort(function (a, b) {
        return Math.abs(a.boundingClientRect.left + a.boundingClientRect.width / 2 - mid) - Math.abs(b.boundingClientRect.left + b.boundingClientRect.width / 2 - mid) || a.boundingClientRect.top - b.boundingClientRect.top;
      });
      hit.forEach(function (en, i) {
        var el = en.target;
        if (el.classList.contains('stg')) el.style.transitionDelay = Math.min(i * 70, 560) + 'ms';
        el.classList.add('in');
        reveal.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    d.querySelectorAll('[data-reveal], .reveal-img, .lines, .draw-in, .stg').forEach(function (el) { reveal.observe(el); });

    var hero = d.querySelector('.hero');
    if (hero) requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add('in'); hero.querySelectorAll('.lines').forEach(function (l) { l.classList.add('in'); }); }); });

    /* -- scrubbed + pinned scenes -- */
    var scrubs = [];
    var visIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target._s.vis = e.isIntersecting; });
      request();
    }, { rootMargin: '30% 0px 30% 0px' });
    var register = function (el, kind) {
      var s = { el: el, kind: kind, vis: false, last: '', beats: 0, stages: null, next: null, nextTop: 0 };
      if (kind === 'pin') {
        s.beats = Number(el.getAttribute('data-beats')) || 0;
        s.stages = s.beats ? [].slice.call(el.querySelectorAll('.stage')) : null;
      }
      if (kind === 'stack') s.next = el.nextElementSibling && el.nextElementSibling.matches('[data-scrub="stack"]') ? el.nextElementSibling : null;
      el._s = s; scrubs.push(s); visIO.observe(el);
    };
    d.querySelectorAll('[data-scrub]').forEach(function (el) { register(el, el.getAttribute('data-scrub')); });
    d.querySelectorAll('.sc .ph, .case-cover .ph, .invite-wide, .feature .ph').forEach(function (el) { el.classList.add('px'); register(el, 'view'); });

    var progress = function (s) {
      var r = s.el.getBoundingClientRect();
      if (s.kind === 'hero') return clamp(-r.top / Math.max(1, r.height));
      if (s.kind === 'view') return clamp((vh - r.top) / (vh + r.height));
      if (s.kind === 'pin') return clamp(-r.top / Math.max(1, r.height - vh));
      if (s.kind === 'stack') {
        if (!s.next) return 0;
        var n = s.next.getBoundingClientRect();
        return clamp((vh - n.top) / Math.max(1, vh - s.nextTop));
      }
      return 0;
    };
    var apply = function (s, p) {
      var v = p.toFixed(3);
      if (v === s.last) return;
      s.last = v;
      s.el.style.setProperty('--p', v);
      if (s.kind === 'pin' && s.beats) {
        var st = Math.min(s.beats, Math.floor(p * s.beats * 0.985) + 1);
        if (s.el.getAttribute('data-stage') !== String(st)) {
          s.el.setAttribute('data-stage', st);
          if (s.stages) s.stages.forEach(function (el, i) { el.classList.toggle('is-active', i === st - 1); el.classList.toggle('is-past', i < st - 1); });
        }
      }
    };
    var measure = function () {
      vw = window.innerWidth; vh = window.innerHeight;
      scrubs.forEach(function (s) { if (s.next) s.nextTop = parseFloat(window.getComputedStyle(s.next).top) || 0; });
    };

    /* -- scroll velocity: the showcase leans into fast scrolling and settles when you stop (clamped to ±2.5°) -- */
    var skewEl = d.querySelector('.showcase'), skewVis = false, lastY = window.scrollY, skew = 0;
    if (skewEl) new IntersectionObserver(function (es) { skewVis = es[0].isIntersecting; request(); }, { rootMargin: '20% 0px' }).observe(skewEl);

    var queued = false;
    var request = function () { if (!queued) { queued = true; requestAnimationFrame(frame); } };
    var frame = function () {
      queued = false;
      var again = false;
      scrubs.forEach(function (s) { if (s.vis) apply(s, progress(s)); });
      var y = window.scrollY;
      if (skewEl && skewVis) {
        var t = clamp((y - lastY) * 0.08, -2.5, 2.5);
        skew += (t - skew) * 0.2;
        if (Math.abs(skew) < 0.01) skew = 0; else again = true;
        skewEl.style.setProperty('--skew', skew.toFixed(2) + 'deg');
      } else if (skewEl && skew !== 0) {      // off screen: reset so it never returns with a stale lean
        skew = 0;
        skewEl.style.setProperty('--skew', '0deg');
      }
      lastY = y;
      if (again) request();
    };
    measure();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', function () { measure(); request(); });
    request();
  }

  /* ---- header: solid once the page scrolls; takes the paper tone while it sits over a paper section ---- */
  if (head) {
    var ticking = false;
    var fab = d.querySelector('.fab');
    var heroEl = d.querySelector('.hero');
    var paint = function () {
      var y = window.scrollY;
      head.classList.toggle('is-scrolled', y > 40);
      if (fab) fab.classList.toggle('show', !heroEl || y > heroEl.offsetHeight * 0.6);
      ticking = false;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();

    var papers = [].slice.call(d.querySelectorAll('.tone-paper')), over = [], toneIO = null, toneT = 0;
    var watchTone = function () {
      if (toneIO) toneIO.disconnect();
      over = [];
      var band = Math.round(head.offsetHeight / 2);
      toneIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var i = over.indexOf(e.target);
          if (e.isIntersecting && i < 0) over.push(e.target); else if (!e.isIntersecting && i >= 0) over.splice(i, 1);
        });
        head.classList.toggle('on-paper', over.length > 0);
      }, { rootMargin: '0px 0px ' + (-(window.innerHeight - band)) + 'px 0px', threshold: 0 });
      papers.forEach(function (el) { toneIO.observe(el); });
    };
    /* the floating WhatsApp pill steps aside while a big call to action is on screen */
    if (fab && 'IntersectionObserver' in window) {
      var cta = new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.target._cta = e.isIntersecting; });
        fab.classList.toggle('fab-off', [].some.call(d.querySelectorAll('.invite, .cta-band'), function (n) { return n._cta; }));
      }, { threshold: 0.35 });
      d.querySelectorAll('.invite, .cta-band').forEach(function (n) { cta.observe(n); });
    }
    if (papers.length && 'IntersectionObserver' in window) {
      watchTone();
      window.addEventListener('resize', function () { clearTimeout(toneT); toneT = setTimeout(watchTone, 150); });
    }
  }
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

  /* ---- gallery lightbox: <a href="large.webp" data-lightbox><img …></a>; prev/next, arrows, swipe ---- */
  var lbLinks = [].slice.call(d.querySelectorAll('a[data-lightbox]'));
  if (lbLinks.length && typeof HTMLDialogElement === 'function') {
    var lb = d.createElement('dialog');
    lb.className = 'lb';
    lb.setAttribute('aria-label', 'Project photo');
    lb.innerHTML = '<div class="lb-head"><p class="lb-title"></p><button class="lb-btn" type="button" data-close aria-label="Close">✕</button></div>' +
      '<div class="lb-stage"><img alt=""></div>' +
      '<div class="lb-foot"><span class="lb-count" aria-live="polite"></span><span class="lb-nav"><button class="lb-btn" type="button" data-step="-1" aria-label="Previous photo">←</button><button class="lb-btn" type="button" data-step="1" aria-label="Next photo">→</button></span></div>';
    d.body.appendChild(lb);
    var lbImg = lb.querySelector('img'), lbTitle = lb.querySelector('.lb-title'), lbCount = lb.querySelector('.lb-count');
    var visible = function () { return lbLinks.filter(function (a) { return a.offsetParent !== null; }); };
    var set = [], at = 0;
    var show = function (i) {
      at = (i + set.length) % set.length;
      var a = set[at], card = a.closest('.proj'), h = card && card.querySelector('h3');
      lbImg.src = a.href;
      lbImg.alt = (a.querySelector('img') || {}).alt || '';
      lbTitle.textContent = h ? h.textContent : lbImg.alt;
      lbCount.textContent = String(at + 1).padStart(2, '0') + ' / ' + String(set.length).padStart(2, '0');
    };
    lbLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        set = visible();
        show(set.indexOf(a));
        lb.showModal();
      });
    });
    lb.addEventListener('click', function (e) {
      var step = e.target.closest('[data-step]');
      if (step) return show(at + Number(step.getAttribute('data-step')));
      if (e.target.closest('[data-close]') || e.target === lb || e.target.classList.contains('lb-stage')) lb.close();
    });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); }
    });
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* ---- expertise index: the row under the pointer / focus drives the stage ---- */
  var rows = d.querySelectorAll('.exp-row');
  rows.forEach(function (r) {
    var on = function () { rows.forEach(function (x) { x.toggleAttribute('data-active', x === r); }); };
    r.addEventListener('mouseenter', on);
    r.addEventListener('focus', on);
  });

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
