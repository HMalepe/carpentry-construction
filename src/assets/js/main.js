/* Malepe R&R — progressive enhancement only. Every link already works without this file. */
(function () {
  'use strict';
  var d = document;
  var root = d.documentElement;
  root.classList.add('js');

  var clamp = function (v, lo, hi) { return Math.max(lo === undefined ? 0 : lo, Math.min(hi === undefined ? 1 : hi, v)); };
  var head = d.querySelector('.site-head');

  /* Reload (the browser's reload button, F5, pull-to-refresh) starts from scratch: back to the top of the page, an empty shortlist,
     and no scroll position restored by Chrome. Back / forward and ordinary links are untouched. */
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload') {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      try { localStorage.removeItem('mrr-shortlist'); localStorage.removeItem('mrr-sl-loc'); localStorage.removeItem('mrr-sl-note'); } catch (e) {}
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      window.scrollTo(0, 0);
      window.addEventListener('load', function () { window.scrollTo(0, 0); }, { once: true });
    }
  } catch (e) {}

  /* ======================================================================
     MOTION ENGINE (vanilla, ~2 KB gz). Only runs when the visitor has not asked for reduced motion.
     Three relationships between scroll and animation:
       triggered : fires once as an element arrives (reveals, ripple stagger)
       scrubbed  : progress 0..1 written to a CSS variable (--p); CSS decides what that means
       pinned    : a tall wrapper holds a sticky scene; progress = how far through the wrapper we are
     No smooth-scroll hijacking: native scrolling is never replaced or delayed.
     ====================================================================== */
  /* Low-end / data-saver devices get the plain, fully readable page (the same one reduced-motion visitors get): no pinned scenes,
     no scroll-driven effects, nothing to repaint while a thumb is scrolling. iPhones and mid-range Androids keep the full experience.
     Signals (Chromium-only ones simply stay undefined elsewhere): <=2 GB RAM, <=2 CPU cores, Save-Data, 2G. */
  var conn = navigator.connection || {};
  var lite = !!((navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
    conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''));
  if (lite) root.classList.add('lite');
  var still = lite || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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

  /* ---- process scene: one scroll = one step, landing exactly on it ----
     Inside the pinned scene (mouse / trackpad devices only; touch screens scroll natively) a wheel notch, trackpad flick or arrow/Page key moves to the next (or previous) step, and anything
     else that stops scrolling between steps (scrollbar drag, momentum) is settled onto the nearest one. At the first step scrolling up and
     the last step scrolling down the page simply carries on, so nobody is ever trapped. No pinned scene (reduced motion, low-end, short
     screens) means none of this runs. */
  (function () {
    var proc = d.querySelector('.proc[data-scrub="pin"]');
    if (!proc || !root.classList.contains('motion')) return;
    var beats = Number(proc.getAttribute('data-beats')) || 0;
    var stick = proc.querySelector('.proc-stick');
    if (beats < 2 || !stick) return;
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;   // touch screens scroll this section natively (see the CSS note)
    var smooth = window.matchMedia('(prefers-reduced-motion: no-preference)').matches ? 'smooth' : 'auto';
    var busy = false, lastWheel = 0, lastDelta = 0, settleT = 0;

    var pinned = function () { return getComputedStyle(stick).position === 'sticky'; };
    // Scroll positions of the steps: first = scene starts, last = scene ends, the rest sit in the middle of their beat
    // (same beat maths as the highlight in the scroll engine above, so the landing step is always the highlighted one).
    var stops = function () {
      var r = proc.getBoundingClientRect(), top = window.scrollY + r.top, len = Math.max(1, r.height - window.innerHeight), out = [];
      for (var k = 0; k < beats; k++) out.push(top + len * (k === 0 ? 0 : k === beats - 1 ? 1 : (k + 0.5) / (beats * 0.985)));
      return out;
    };
    var nearest = function (y, st) { var b = 0; st.forEach(function (v, i) { if (Math.abs(v - y) < Math.abs(st[b] - y)) b = i; }); return b; };
    var inside = function (y, st) { return y >= st[0] - 2 && y <= st[st.length - 1] + 2; };
    // target for a move in direction dir (+1 down / -1 up) from the current position, or null when the page should just scroll on
    var target = function (dir) {
      var y = window.scrollY, st = stops();
      if (!inside(y, st)) return null;
      for (var i = dir > 0 ? 0 : st.length - 1; dir > 0 ? i < st.length : i >= 0; i += dir) if (dir > 0 ? st[i] > y + 4 : st[i] < y - 4) return st[i];
      return null;
    };
    var go = function (y) {
      busy = true; clearTimeout(settleT);
      window.scrollTo({ top: y, behavior: smooth });
      var t0 = performance.now();
      (function wait() {
        if (Math.abs(window.scrollY - y) < 1.5 || performance.now() - t0 > 1100) { busy = false; return; }
        requestAnimationFrame(wait);
      })();
    };
    var step = function (dir) { var y = target(dir); if (y === null) return false; go(y); return true; };

    var ownFlick = false;   // true while the tail of a flick that WE turned into a step is still arriving
    d.addEventListener('wheel', function (e) {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || !pinned()) return;
      var inZone = inside(window.scrollY, stops());
      if (!inZone && !busy) { ownFlick = false; return; }
      var now = performance.now(), dy = Math.abs(e.deltaY);
      var fresh = now - lastWheel > 180 || dy > lastDelta * 1.6;   // a new flick, not the tail of trackpad momentum
      lastWheel = now; lastDelta = dy;
      if (!fresh) { if (ownFlick || busy) e.preventDefault(); return; }   // momentum tail: swallow it only if we are the ones moving the page
      ownFlick = false;
      if (busy) { e.preventDefault(); ownFlick = true; return; }
      if (step(e.deltaY > 0 ? 1 : -1)) { e.preventDefault(); ownFlick = true; }   // otherwise (first step up / last step down) the page just scrolls on
    }, { passive: false });

    d.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || !pinned() || /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test((e.target || {}).tagName || '')) return;
      var dir = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key] || (e.key === ' ' ? (e.shiftKey ? -1 : 1) : 0);
      if (!dir || busy && inside(window.scrollY, stops())) { if (dir) e.preventDefault(); return; }
      if (step(dir)) e.preventDefault();
    });

    // anything that comes to rest between two steps (scrollbar, momentum, find-in-page) is settled onto the nearest one
    window.addEventListener('scroll', function () {
      if (busy) return;
      clearTimeout(settleT);
      settleT = setTimeout(function () {
        var st = stops(), y = window.scrollY;
        if (busy || !pinned() || !inside(y, st)) return;
        var i = nearest(y, st); if (Math.abs(st[i] - y) > 2) go(st[i]);
      }, 170);
    }, { passive: true });
  })();

  /* ---- header: solid once the page scrolls; takes the paper tone while it sits over a paper section ---- */
  if (head) {
    var ticking = false;
    var fab = d.querySelector('.fab');
    var heroEl = d.querySelector('.hero, .open');
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


  /* ---- shortlist composer: tap + Shortlist on any job; the message to WhatsApp writes itself ---- */
  var picks = (function () {
    var KEY = 'mrr-shortlist', LOC = 'mrr-sl-loc', NOTE = 'mrr-sl-note', items = [];
    var bar = d.querySelector('.pickbar'), count = d.querySelector('[data-pick-count]');
    var dlg = d.getElementById('composer');
    var list = dlg && dlg.querySelector('[data-comp-list]'), prev = dlg && dlg.querySelector('[data-comp-preview]');
    var send = dlg && dlg.querySelector('[data-comp-send]'), loc = d.getElementById('comp-loc'), note = d.getElementById('comp-note');
    function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
    function load() {
      try { var v = JSON.parse(store(KEY) || '[]'); items = Array.isArray(v) ? v.filter(function (x) { return x && x.slug && x.title; }) : []; } catch (e) { items = []; }
    }
    function has(slug) { return items.some(function (i) { return i.slug === slug; }); }
    function message() {
      var cats = [];
      items.forEach(function (i) { if (cats.indexOf(i.cat) < 0) cats.push(i.cat); });
      // Opening line matches waMessage() in scripts/lib.mjs.
      var lines = ['Hi ' + BRAND + ", I'd like a quote.", 'Service: Carpentry' + (cats.length ? ' › ' + cats.join(', ') : ''), 'Jobs like these:'];
      items.forEach(function (i) { lines.push('• ' + i.title + ' (' + i.cat + ')'); });
      lines.push('Location: ' + (loc ? loc.value.trim() : ''), 'Details: ' + (note ? note.value.trim() : ''));
      return lines.join('\n');
    }
    function paint() {
      if (!dlg) return;
      list.innerHTML = '';
      items.forEach(function (i) {
        var li = d.createElement('li'), b = d.createElement('button');
        li.innerHTML = '<span><b></b><small></small></span>';
        li.querySelector('b').textContent = i.title;
        li.querySelector('small').textContent = i.cat;
        b.type = 'button'; b.className = 'comp-x'; b.setAttribute('data-remove', i.slug);
        b.setAttribute('aria-label', 'Remove ' + i.title); b.textContent = '✕';
        li.appendChild(b); list.appendChild(li);
      });
      var m = message();
      prev.textContent = m;
      send.href = waUrl(m);
    }
    function sync() {
      d.querySelectorAll('[data-pick]').forEach(function (b) {
        var on = has(b.getAttribute('data-pick'));
        b.hidden = false;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.classList.toggle('on', on);
        b.querySelector('.pick-t').textContent = on ? 'Shortlisted' : 'Shortlist';
        b.querySelector('.pick-on').textContent = on ? '✓' : '+';
      });
      if (bar) bar.hidden = !items.length;
      if (count) count.textContent = String(items.length);
      d.body.classList.toggle('has-picks', items.length > 0);
      if (dlg && dlg.open) paint();
    }
    function toggle(btn) {
      var slug = btn.getAttribute('data-pick');
      if (has(slug)) items = items.filter(function (i) { return i.slug !== slug; });
      else items.push({ slug: slug, title: btn.getAttribute('data-title'), cat: btn.getAttribute('data-cat') });
      store(KEY, JSON.stringify(items));
      sync();
    }
    function open() {
      if (!items.length) return;
      if (loc && !loc.value) loc.value = store(LOC) || '';
      if (note && !note.value) note.value = store(NOTE) || '';
      paint();
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else window.open(send.href, '_blank', 'noopener');
    }
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-pick]');
      if (b) { toggle(b); return; }
      if (e.target.closest && e.target.closest('.pickbar-open')) open();
    });
    if (dlg) {
      dlg.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-remove]');
        if (rm) {
          items = items.filter(function (i) { return i.slug !== rm.getAttribute('data-remove'); });
          store(KEY, JSON.stringify(items)); sync();
          if (!items.length) dlg.close();
          return;
        }
        if (e.target.closest('[data-comp-clear]')) { items = []; store(KEY, '[]'); sync(); dlg.close(); return; }
        if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
      });
      loc.addEventListener('input', function () { store(LOC, loc.value); paint(); });
      note.addEventListener('input', function () { store(NOTE, note.value); paint(); });
    }
    window.addEventListener('pageshow', function () { load(); sync(); }); // back/forward cache: re-read the shortlist
    load(); sync();
    return { has: has, toggle: toggle };
  })();

  /* ---- catalogue rails: arrows appear only when a rail overflows ---- */
  d.querySelectorAll('.cat').forEach(function (cat) {
    var rail = cat.querySelector('.rail'), ctl = cat.querySelector('.rail-ctl');
    if (!rail || !ctl) return;
    var back = ctl.children[0], fwd = ctl.children[1];
    function upd() {
      ctl.hidden = rail.scrollWidth <= rail.clientWidth + 4;
      back.disabled = rail.scrollLeft < 4;
      fwd.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rail]');
      if (b) rail.scrollBy({ left: Number(b.getAttribute('data-rail')) * rail.clientWidth * 0.85, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    rail.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    upd();
    // A rail that was skipped for rendering (content-visibility) is only laid out once it nears the screen: measure then.
    rail.addEventListener('contentvisibilityautostatechange', function (e) { if (!e.skipped) upd(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { if (e[0].isIntersecting) requestAnimationFrame(function () { requestAnimationFrame(upd); }); }).observe(rail);
  });

  /* ---- gallery lightbox: <a href="large.webp" data-lightbox><img …></a>; prev/next, arrows, swipe ---- */
  var lbLinks = [].slice.call(d.querySelectorAll('a[data-lightbox]'));
  if (lbLinks.length && typeof HTMLDialogElement === 'function') {
    var lb = d.createElement('dialog');
    lb.className = 'lb';
    lb.setAttribute('aria-label', 'Project photo');
    lb.innerHTML = '<div class="lb-head"><p class="lb-title"></p><button class="lb-btn" type="button" data-close aria-label="Close">✕</button></div>' +
      '<div class="lb-stage"><img alt=""></div>' +
      '<div class="lb-foot"><span class="lb-count" aria-live="polite"></span><button class="lb-pick" type="button" hidden></button><span class="lb-nav"><button class="lb-btn" type="button" data-step="-1" aria-label="Previous photo">←</button><button class="lb-btn" type="button" data-step="1" aria-label="Next photo">→</button></span></div>';
    d.body.appendChild(lb);
    var lbImg = lb.querySelector('img'), lbTitle = lb.querySelector('.lb-title'), lbCount = lb.querySelector('.lb-count'), lbPick = lb.querySelector('.lb-pick');
    // A photo is in the set unless the gallery filter has hidden its card (rails that are skipped for rendering still count).
    var visible = function () {
      return lbLinks.filter(function (a) { var c = a.closest('.proj, .tile'); return !c || getComputedStyle(c).display !== 'none'; });
    };
    var set = [], at = 0;
    var show = function (i) {
      at = (i + set.length) % set.length;
      var a = set[at], card = a.closest('.proj, .tile'), h = card && card.querySelector('h3, h4'), pb = card && card.querySelector('[data-pick]');
      lbImg.src = a.href;
      lbImg.alt = (a.querySelector('img') || {}).alt || '';
      lbTitle.textContent = h ? h.textContent : lbImg.alt;
      lbCount.textContent = (at + 1) + ' of ' + set.length;
      lbPick.hidden = !pb; lbPick.pick = pb;
      if (pb) lbPick.textContent = picks.has(pb.getAttribute('data-pick')) ? '✓ Shortlisted' : '+ Shortlist this job';
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
      if (e.target.closest('.lb-pick') && lbPick.pick) { picks.toggle(lbPick.pick); lbPick.textContent = picks.has(lbPick.pick.getAttribute('data-pick')) ? '✓ Shortlisted' : '+ Shortlist this job'; return; }
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
