/**
 * Material 3 Expressive Motion & Page-to-Page Transition Engine.
 * Implements:
 *  - Expressive Spatial & Effects spring page transitions for both MPA & SPA navigation
 *  - Top Material 3 Expressive Wavy/Pill Progress Indicator during route changes
 *  - Staggered spring entrance cascade for product cards
 *  - Material Design 3 pointerdown Ripple wave engine
 */
(function (root) {
  'use strict';

  const NAV_STORAGE_KEY = 'ozmd3NavTransitionState';
  const PROGRESS_ID = 'ozmd3-nav-progress';

  let lastKnownHref = typeof location !== 'undefined' ? location.href : '';
  let progressHideTimer = null;
  let enterCleanupTimer = null;
  let rippleBound = false;
  let navBound = false;

  function getSettingsSafe() {
    return root.__ozmd3CurrentSettings || (root.OzonMD3Color ? root.OzonMD3Color.DEFAULT_SETTINGS : {});
  }

  function ensureProgressBar() {
    let bar = document.getElementById(PROGRESS_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = PROGRESS_ID;
      bar.setAttribute('aria-hidden', 'true');
      const track = document.createElement('div');
      track.className = 'ozmd3-nav-progress-track';
      const fill = document.createElement('div');
      fill.className = 'ozmd3-nav-progress-fill';
      track.appendChild(fill);
      bar.appendChild(track);
      (document.body || document.documentElement).appendChild(bar);
    }
    return bar;
  }

  function showProgressBar() {
    const s = getSettingsSafe();
    if (!s.enabled || s.pageTransitions === false) return;
    const bar = ensureProgressBar();
    clearTimeout(progressHideTimer);
    bar.classList.remove('is-finishing');
    bar.classList.add('is-active');
  }

  function finishProgressBar() {
    const bar = document.getElementById(PROGRESS_ID);
    if (!bar) return;
    bar.classList.add('is-finishing');
    clearTimeout(progressHideTimer);
    progressHideTimer = setTimeout(() => {
      bar.classList.remove('is-active', 'is-finishing');
    }, 360);
  }

  function getPageTarget() {
    return (
      document.querySelector('#layoutPage > div:not([data-widget="header"])') ||
      document.querySelector('main') ||
      document.querySelector('#layoutPage') ||
      document.body
    );
  }

  function triggerExpressiveEnter(direction = 'forward') {
    const s = getSettingsSafe();
    if (!s.enabled || s.pageTransitions === false) return;

    const html = document.documentElement;
    const style = s.transitionStyle || 'shared-axis';
    html.setAttribute('data-ozmd3-trans-style', style);
    html.setAttribute('data-ozmd3-trans-dir', direction);

    const target = getPageTarget();
    if (target) {
      target.classList.remove('ozmd3-page-exiting', 'ozmd3-page-entering');
      void target.offsetWidth;
      target.classList.add('ozmd3-page-entering');

      const durationMs = s.transitionSpeed === 'fast' ? 380 : s.transitionSpeed === 'slow' ? 680 : 530;
      clearTimeout(enterCleanupTimer);
      enterCleanupTimer = setTimeout(() => {
        if (target) target.classList.remove('ozmd3-page-entering');
        finishProgressBar();
      }, durationMs);
    }

    staggerCardsInViewport();
  }

  function triggerExpressiveExit(direction = 'forward') {
    const s = getSettingsSafe();
    if (!s.enabled || s.pageTransitions === false) return;

    try {
      sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify({
        ts: Date.now(),
        dir: direction,
        from: location.pathname
      }));
    } catch (_) {
      // Ignore sessionStorage restrictions
    }

    showProgressBar();
    const target = getPageTarget();
    if (target) {
      document.documentElement.setAttribute('data-ozmd3-trans-dir', direction);
      target.classList.remove('ozmd3-page-entering');
      target.classList.add('ozmd3-page-exiting');
    }
  }

  function consumePendingMpaEnter() {
    const s = getSettingsSafe();
    if (!s.enabled || s.pageTransitions === false) return;

    let direction = 'forward';
    try {
      const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
      if (raw) {
        sessionStorage.removeItem(NAV_STORAGE_KEY);
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() - Number(parsed.ts) < 6000) {
          direction = parsed.dir === 'back' ? 'back' : 'forward';
        }
      }
    } catch (_) {
      // Ignore
    }

    showProgressBar();
    requestAnimationFrame(() => {
      triggerExpressiveEnter(direction);
    });
  }

  function staggerCardsInViewport(rootEl) {
    const s = getSettingsSafe();
    if (!s.enabled || s.pageTransitions === false) return;
    const scope = rootEl && rootEl.querySelectorAll ? rootEl : document;
    const cards = scope.querySelectorAll('div[data-index], .tile-root');
    let idx = 0;
    for (let i = 0; i < cards.length && idx < 24; i++) {
      const card = cards[i];
      if (card.closest('[data-ozmd3-ad-hidden="1"]') || card.dataset.ozmd3Staggered === '1') continue;
      card.dataset.ozmd3Staggered = '1';
      card.style.setProperty('--ozmd3-stagger-i', String(idx));
      card.classList.add('ozmd3-card-cascade');
      idx++;
    }
  }

  function handleRouteChange(direction = 'forward') {
    const current = location.href;
    if (current === lastKnownHref) return;
    lastKnownHref = current;

    const s = getSettingsSafe();
    if (!s.enabled || s.pageTransitions === false) return;

    showProgressBar();
    if (typeof document.startViewTransition === 'function' && !document.hidden) {
      // Keep native view transitions fast and layered cleanly with our card cascade
      triggerExpressiveEnter(direction);
    } else {
      triggerExpressiveEnter(direction);
    }
  }

  function setupNavigationListeners() {
    if (navBound) return;
    navBound = true;

    // 1. Intercept internal <a> clicks for instant exit glide + progress indicator
    document.addEventListener('click', ev => {
      const s = getSettingsSafe();
      if (!s.enabled || s.pageTransitions === false) return;
      if (ev.defaultPrevented || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;

      const anchor = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!anchor || anchor.closest('#ozmd3-quick-panel, #ozmd3-fab')) return;
      if (anchor.target && anchor.target !== '_self') return;

      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

      try {
        const dest = new URL(anchor.href, location.href);
        if (dest.origin === location.origin && dest.href !== location.href) {
          const isBack = Boolean(anchor.closest('[class*="breadcrumb" i], [aria-label*="Назад" i]'));
          triggerExpressiveExit(isBack ? 'back' : 'forward');
        }
      } catch (_) {
        // Ignore invalid URL
      }
    }, true);

    // 2. Modern Navigation API (Chrome, Edge, Opera, Yandex, Brave)
    if (root.navigation && typeof root.navigation.addEventListener === 'function') {
      root.navigation.addEventListener('navigate', ev => {
        if (!ev || !ev.destination) return;
        const dir = ev.navigationType === 'traverse' ? 'back' : 'forward';
        showProgressBar();
        setTimeout(() => {
          handleRouteChange(dir);
        }, 40);
      });
    }

    // 3. History popstate & hashchange (all browsers including Firefox & Safari)
    root.addEventListener('popstate', () => {
      handleRouteChange('back');
    });
    root.addEventListener('hashchange', () => {
      handleRouteChange('forward');
    });
  }

  function setupRippleListener() {
    if (rippleBound) return;
    rippleBound = true;

    document.addEventListener('pointerdown', ev => {
      const s = getSettingsSafe();
      if (!s.enabled || s.rippleEffect === false) return;
      if (ev.button !== 0) return;

      const target = ev.target && ev.target.closest
        ? ev.target.closest('button, a[role="button"], [data-ozmd3-btn], [data-ozmd3-chip], .tile-root, div[data-index]')
        : null;
      if (!target || target.closest('#ozmd3-quick-panel, #ozmd3-fab')) return;

      const rect = target.getBoundingClientRect();
      if (rect.width < 12 || rect.height < 12) return;

      const prevPos = window.getComputedStyle(target).position;
      if (prevPos === 'static') {
        target.classList.add('ozmd3-ripple-host');
      }

      const size = Math.max(rect.width, rect.height) * 2.1;
      const x = ev.clientX - rect.left - size / 2;
      const y = ev.clientY - rect.top - size / 2;

      const wave = document.createElement('span');
      wave.className = 'ozmd3-ripple-wave';
      wave.style.width = `${size}px`;
      wave.style.height = `${size}px`;
      wave.style.left = `${x}px`;
      wave.style.top = `${y}px`;
      target.appendChild(wave);

      setTimeout(() => {
        if (wave.parentElement) wave.remove();
      }, 600);
    }, { passive: true });
  }

  function checkHrefChanged() {
    if (location.href !== lastKnownHref) {
      handleRouteChange('forward');
    }
  }

  root.OzonMD3Transitions = {
    setupNavigationListeners,
    setupRippleListener,
    consumePendingMpaEnter,
    triggerExpressiveEnter,
    staggerCardsInViewport,
    checkHrefChanged
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
