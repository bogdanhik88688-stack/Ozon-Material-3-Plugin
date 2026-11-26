/**
 * Ozon Material 3 Expressive — Main Content Script Orchestrator.
 * Coordinates:
 *  - Zero-FOUC HCT color & shape/size token injection
 *  - Semantic & computed-style DOM classifier for Ozon's dynamic classes
 *  - Multi-layer ad & banner annihilator
 *  - Material Symbols Rounded icon rewriting
 *  - Material 3 Expressive page-to-page transitions, card hover animations & ripples
 *  - Floating Quick Studio panel on Ozon
 */
(function () {
  'use strict';

  const VARS_STYLE_ID = 'ozmd3-vars-sheet';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let currentSettings = Object.assign({}, OzonMD3Color.DEFAULT_SETTINGS);
  window.__ozmd3CurrentSettings = currentSettings;

  let appliedVarKeys = [];
  let domObserver = null;
  let scanTimer = null;
  let quickPanelOpen = false;
  let quickColorTarget = 'accent';
  let lastScrollY = 0;
  let scrollHideBound = false;

  function mergeSettings(raw) {
    return Object.assign({}, OzonMD3Color.DEFAULT_SETTINGS, raw && typeof raw === 'object' ? raw : {});
  }

  function resolveIsDark() {
    if (currentSettings.themeMode === 'dark') return true;
    if (currentSettings.themeMode === 'light') return false;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    return false;
  }

  function clearCssVariables() {
    const style = document.documentElement.style;
    for (let i = 0; i < appliedVarKeys.length; i++) {
      style.removeProperty(appliedVarKeys[i]);
    }
    appliedVarKeys = [];
    const sheet = document.getElementById(VARS_STYLE_ID);
    if (sheet) sheet.remove();
  }

  function injectVarsStylesheet(vars) {
    const parent = document.head || document.documentElement;
    if (!parent) return;
    let sheet = document.getElementById(VARS_STYLE_ID);
    if (!sheet) {
      sheet = document.createElement('style');
      sheet.id = VARS_STYLE_ID;
      parent.appendChild(sheet);
    }
    const body = Object.keys(vars).map(k => `  ${k}: ${vars[k]} !important;`).join('\n');
    sheet.textContent = `html[data-ozmd3="on"], html[data-ozmd3="on"] body {\n${body}\n}`;
  }

  function removeQuickStudio() {
    const fab = document.getElementById('ozmd3-fab');
    if (fab) fab.remove();
    const panel = document.getElementById('ozmd3-quick-panel');
    if (panel) panel.remove();
    quickPanelOpen = false;
  }

  function applyThemeAndFlags() {
    const html = document.documentElement;
    window.__ozmd3CurrentSettings = currentSettings;

    if (!currentSettings.enabled) {
      [
        'data-ozmd3', 'data-ozmd3-theme', 'data-ozmd3-font', 'data-ozmd3-font-scaled',
        'data-ozmd3-cards', 'data-ozmd3-hover', 'data-ozmd3-icons', 'data-ozmd3-ads',
        'data-ozmd3-custom-text', 'data-ozmd3-trans-style', 'data-ozmd3-trans-dir',
        'data-ozmd3-fab', 'data-ozmd3-full-accent', 'data-ozmd3-price-badges'
      ].forEach(attr => html.removeAttribute(attr));
      clearCssVariables();
      if (window.OzonMD3AdBlock) OzonMD3AdBlock.restoreAds(document);
      if (window.OzonMD3Icons) OzonMD3Icons.restoreOriginalIcons(document);
      cleanupSemanticRoles();
      removeQuickStudio();
      return;
    }

    const isDark = resolveIsDark();
    const scheme = OzonMD3Color.generateScheme({
      seedColor: currentSettings.seedColor,
      isDark,
      schemeStyle: currentSettings.schemeStyle,
      contrastLevel: currentSettings.contrastLevel,
      amoled: currentSettings.amoled,
      fullAccentFill: currentSettings.fullAccentFill !== false
    });
    const vars = OzonMD3Color.schemeToCssVariables(scheme, currentSettings);

    const style = html.style;
    const keys = Object.keys(vars);
    for (let i = 0; i < keys.length; i++) {
      style.setProperty(keys[i], vars[keys[i]], 'important');
    }
    appliedVarKeys = keys;
    injectVarsStylesheet(vars);

    html.setAttribute('data-ozmd3', 'on');
    html.setAttribute('data-ozmd3-theme', isDark ? 'dark' : 'light');
    html.setAttribute('data-ozmd3-font', currentSettings.md3Font !== false ? 'on' : 'off');
    html.setAttribute('data-ozmd3-font-scaled', Math.abs((Number(currentSettings.fontScale) || 1) - 1) > 0.01 ? 'on' : 'off');
    html.setAttribute('data-ozmd3-cards', currentSettings.tonalCards !== false ? 'on' : 'off');
    html.setAttribute('data-ozmd3-hover', currentSettings.cardHoverAnim || 'spring');
    html.setAttribute('data-ozmd3-icons', currentSettings.rewriteIcons !== false ? 'on' : 'off');
    html.setAttribute('data-ozmd3-ads', currentSettings.blockAds !== false ? 'on' : 'off');
    html.setAttribute('data-ozmd3-custom-text', OzonMD3Color.isValidHex(currentSettings.customTextColor) ? 'on' : 'off');
    html.setAttribute('data-ozmd3-trans-style', currentSettings.transitionStyle || 'shared-axis');
    html.setAttribute('data-ozmd3-fab', currentSettings.floatingStudio !== false ? 'on' : 'off');
    html.setAttribute('data-ozmd3-full-accent', currentSettings.fullAccentFill !== false ? 'on' : 'off');
    html.setAttribute('data-ozmd3-price-badges', currentSettings.priceBadges !== false ? 'on' : 'off');
  }

  /* ============================================================================
     Semantic Classifier (Full Accent Surface Painting + Price Badges + Buttons)
     ============================================================================ */
  function isBrightOzonAccent(rgbStr) {
    if (!rgbStr || rgbStr === 'transparent' || rgbStr === 'rgba(0, 0, 0, 0)') return null;
    const m = rgbStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/);
    if (!m) return null;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    const a = m[4] !== undefined ? Number(m[4]) : 1;
    if (a < 0.12) return null;
    // Ozon Blue (#005BFF)
    if (b > 200 && r < 40 && g < 130) return 'ozon-blue';
    // Ozon Card Pink / Red (#F91155)
    if (r > 210 && g < 60 && b > 50 && b < 130) return 'ozon-pink';
    // Ozon Green (#10C44C)
    if (g > 165 && r < 60 && b < 110) return 'ozon-green';
    // White / Light Neutral / Pale Ice-Blue Ozon Background (#fff, #eff3f6, #f2f5f9, #edf3ff)
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (r > 192 && g > 192 && b > 192 && (maxC - minC) < 52) return 'light-bg';
    return null;
  }

  function hasWhiteLinearGradient(bgImg) {
    if (!bgImg || bgImg === 'none') return false;
    return /rgb\(\s*255,\s*255,\s*255|rgba\(\s*255,\s*255,\s*255|#fff/i.test(bgImg);
  }

  function classifyButton(btn) {
    if (!btn || btn.dataset.ozmd3Classified === '1') return;
    if (btn.closest('#ozmd3-quick-panel, #ozmd3-fab, [data-ozmd3-ad-hidden="1"]')) return;
    btn.dataset.ozmd3Classified = '1';

    const rect = btn.getBoundingClientRect();
    const text = (btn.textContent || '').trim();
    const cs = window.getComputedStyle(btn);
    const colorTag = isBrightOzonAccent(cs.backgroundColor);

    if (colorTag === 'ozon-blue' || colorTag === 'ozon-pink' || colorTag === 'ozon-green' ||
        /в корзину|купить|оформить|каталог|войти/i.test(text)) {
      btn.setAttribute('data-ozmd3-role', 'btn-primary');
      btn.setAttribute('data-ozmd3-btn', 'primary');
      return;
    }

    if (rect.width > 0 && rect.width <= 44 && rect.height <= 44 && !text) {
      btn.setAttribute('data-ozmd3-btn', 'icon');
      return;
    }

    if (colorTag === 'light-bg' && text.length > 0 && rect.height >= 30) {
      btn.setAttribute('data-ozmd3-role', 'btn-tonal');
      btn.setAttribute('data-ozmd3-btn', 'tonal');
      return;
    }

    if (text.length > 0 && rect.height >= 26 && rect.height <= 64) {
      btn.setAttribute('data-ozmd3-btn', 'regular');
    }
  }

  function classifyPrices(scope) {
    if (currentSettings.priceBadges === false) return;
    const PRICE_TEXT_RE = /^\s*\d[\d\s\u00A0\u2009\u202F.,]*\s*₽\s*$/;
    const NUM_OR_PRICE_RE = /^\s*\d[\d\s\u00A0\u2009\u202F.,]*(?:\s*₽)?\s*$/;
    const DISCOUNT_RE = /^\s*[-−–]\s*\d{1,2}\s*%\s*$/;
    const containers = scope.querySelectorAll(
      '[data-ozmd3-role="card"], .tile-root, div[data-index], ' +
      '[data-widget="webPrice"], [data-widget="webSale"], [data-widget*="price" i], [data-widget="cart"]'
    );

    for (let i = 0; i < containers.length; i++) {
      const box = containers[i];
      if (box.closest('[data-ozmd3-ad-hidden="1"], #ozmd3-quick-panel')) continue;

      const candidates = box.querySelectorAll('span, div, b, strong');
      const mainPrices = [];

      for (let j = 0; j < candidates.length; j++) {
        const el = candidates[j];
        if (el.closest('button, a[role="button"], [data-ozmd3-role="btn-primary"]')) continue;
        if (el.childElementCount > 3) continue;

        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt) continue;

        // 1. Discount badge (-35%, -80%, etc.)
        if (el.childElementCount <= 1 && DISCOUNT_RE.test(txt)) {
          el.setAttribute('data-ozmd3-role', 'discount-pill');
          continue;
        }

        // 2. Old strikethrough price (with or without ₽)
        if (NUM_OR_PRICE_RE.test(txt)) {
          const cs = window.getComputedStyle(el);
          const deco = (cs.textDecorationLine || cs.textDecoration || '').toLowerCase();
          if (deco.includes('line-through')) {
            let childIsStrike = false;
            for (let c = 0; c < el.children.length; c++) {
              const cTxt = (el.children[c].textContent || '').replace(/\s+/g, ' ').trim();
              if (NUM_OR_PRICE_RE.test(cTxt)) {
                childIsStrike = true;
                break;
              }
            }
            if (!childIsStrike) {
              el.setAttribute('data-ozmd3-role', 'price-old');
            }
            continue;
          }
        }

        // 3. Active main price (must contain ₽)
        if (!PRICE_TEXT_RE.test(txt)) continue;
        let childHasFullPrice = false;
        for (let c = 0; c < el.children.length; c++) {
          const cTxt = (el.children[c].textContent || '').replace(/\s+/g, ' ').trim();
          if (PRICE_TEXT_RE.test(cTxt)) {
            childHasFullPrice = true;
            break;
          }
        }
        if (childHasFullPrice) continue;

        const cs = window.getComputedStyle(el);
        const fontSize = parseFloat(cs.fontSize || '14');
        const rect = el.getBoundingClientRect();
        if (fontSize < 11 || (rect.height > 68 && rect.width > 280)) continue;

        mainPrices.push(el);
      }

      // Wrap either the tight price+old+discount row OR the standalone price element
      for (let m = 0; m < mainPrices.length; m++) {
        const mainEl = mainPrices[m];
        if (mainEl.closest('[data-ozmd3-role="price-row"], [data-ozmd3-role="price-pill"]')) continue;

        let row = mainEl.parentElement;
        if (row && row !== box && row.childElementCount === 1 && row.parentElement && row.parentElement !== box) {
          row = row.parentElement;
        }
        const rowTxt = row ? (row.textContent || '').replace(/\s+/g, ' ').trim() : '';
        const rowHasSiblings = row &&
          row !== box &&
          !row.matches('[data-ozmd3-role="card"], .tile-root, div[data-index], a') &&
          row.childElementCount >= 2 &&
          row.childElementCount <= 5 &&
          rowTxt.length <= 44 &&
          Boolean(row.querySelector('[data-ozmd3-role="price-old"], [data-ozmd3-role="discount-pill"]'));

        const markPriceSlots = startEl => {
          let p = startEl ? startEl.parentElement : null;
          for (let depth = 0; depth < 2 && p && p !== box && !p.matches('[data-ozmd3-role="card"], .tile-root, div[data-index]'); depth++) {
            const pTxt = (p.textContent || '').trim();
            if (p.querySelector('a[href*="/product/"]') && pTxt.length > 48) break;
            p.setAttribute('data-ozmd3-price-slot', '1');
            p = p.parentElement;
          }
        };

        if (rowHasSiblings) {
          row.setAttribute('data-ozmd3-role', 'price-row');
          mainEl.setAttribute('data-ozmd3-role', 'price-main');
          markPriceSlots(row);
        } else {
          mainEl.setAttribute('data-ozmd3-role', 'price-pill');
          markPriceSlots(mainEl);
        }
      }
    }
  }

  function paintAllLightSurfaces(scope) {
    const rootTarget = scope === document ? (document.body || document.documentElement) : scope;
    if (!rootTarget || !rootTarget.querySelectorAll) return;

    const vw = window.innerWidth || 1280;
    const nodes = rootTarget.querySelectorAll('div, section, article, aside, nav, ul, li, main, a, span, table, tbody, tr, td, th, form, fieldset');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.hasAttribute('data-ozmd3-bg')) continue;
      if (el.getAttribute('data-ozmd3-ad-hidden') === '1') continue;
      if (el.closest('#ozmd3-quick-panel, #ozmd3-fab, #ozmd3-nav-progress, [data-ozmd3-role="price-row"], [data-ozmd3-role="price-pill"], [data-ozmd3-role="discount-pill"], [data-ozmd3-role="btn-primary"], [data-ozmd3-role="btn-tonal"]')) {
        continue;
      }
      if (el.matches('header, [data-widget="header"], footer, [data-widget="footer"], [data-ozmd3-role="card"], .tile-root')) {
        continue;
      }
      if (el.tagName === 'A') {
        const aRect = el.getBoundingClientRect();
        if (aRect.width < 80 || aRect.height < 36) continue;
      }

      const cs = window.getComputedStyle(el);
      const tag = isBrightOzonAccent(cs.backgroundColor);
      const whiteGrad = hasWhiteLinearGradient(cs.backgroundImage);
      if (tag !== 'light-bg' && !whiteGrad) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      if (el.tagName === 'SPAN') {
        if (rect.width <= 180 && rect.height <= 44) {
          el.setAttribute('data-ozmd3-bg', 'container-high');
        } else {
          el.setAttribute('data-ozmd3-bg', 'transparent');
        }
        continue;
      }

      // Inside an already themed card, neutralize inner white wrappers
      if (el.closest('[data-ozmd3-role="card"], .tile-root')) {
        el.setAttribute('data-ozmd3-bg', 'transparent');
        continue;
      }

      // Full-width layout wrappers match primary surface; widgets/panels get tonal containers
      if (rect.width >= vw * 0.85 || el.id === 'layoutPage' || el.matches('main')) {
        el.setAttribute('data-ozmd3-bg', 'surface');
      } else if (el.matches('[role="dialog"], [role="menu"], [role="listbox"]')) {
        el.setAttribute('data-ozmd3-bg', 'surface-high');
      } else if (el.hasAttribute('data-widget') || rect.width <= 460 || rect.height <= 420) {
        el.setAttribute('data-ozmd3-bg', 'container');
      } else {
        el.setAttribute('data-ozmd3-bg', 'container-low');
      }
    }
  }

  function classifyOzonElements(rootEl) {
    const scope = rootEl && rootEl.querySelectorAll ? rootEl : document;

    // 1. Search Box
    const searchForms = scope.querySelectorAll('[data-widget*="search" i] form, [data-widget="searchBarDesktop"] form');
    for (let i = 0; i < searchForms.length; i++) {
      searchForms[i].setAttribute('data-ozmd3-role', 'search-box');
    }

    // 2. Product Cards (search results, grids, shelves)
    const cards = scope.querySelectorAll('div[data-index], .tile-root, [data-widget="skuShelfGoods"] a[href*="/product/"], [data-widget="skuGrid"] > div > div');
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (card.closest('[data-ozmd3-ad-hidden="1"]')) continue;
      if (card.tagName === 'A') {
        const box = card.closest('div[class]') || card;
        box.setAttribute('data-ozmd3-role', 'card');
      } else {
        card.setAttribute('data-ozmd3-role', 'card');
      }
    }

    // 3. Buttons & CTA Links
    const buttons = scope.querySelectorAll('button, a[role="button"]');
    for (let i = 0; i < buttons.length; i++) {
      classifyButton(buttons[i]);
    }

    // 4. Price Pills (подложки под цены товаров)
    classifyPrices(scope);

    // 5. Repaint ALL white/off-white containers across Ozon with accent-tinted MD3 surfaces
    paintAllLightSurfaces(scope);

    // 6. Rounded inputs
    const inputs = scope.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select');
    for (let i = 0; i < inputs.length; i++) {
      if (!inputs[i].closest('#ozmd3-quick-panel')) {
        inputs[i].setAttribute('data-ozmd3-role', 'input');
      }
    }
  }

  function cleanupSemanticRoles() {
    document.querySelectorAll('[data-ozmd3-role], [data-ozmd3-btn], [data-ozmd3-bg], [data-ozmd3-price-slot], [data-ozmd3-classified], [data-ozmd3-surface-checked]').forEach(el => {
      el.removeAttribute('data-ozmd3-role');
      el.removeAttribute('data-ozmd3-btn');
      el.removeAttribute('data-ozmd3-bg');
      el.removeAttribute('data-ozmd3-price-slot');
      delete el.dataset.ozmd3Classified;
      delete el.dataset.ozmd3SurfaceChecked;
    });
  }

  /* ============================================================================
     Floating Quick Studio FAB & Live Panel on Ozon
     ============================================================================ */
  function persistPatch(partial) {
    currentSettings = mergeSettings(Object.assign({}, currentSettings, partial));
    applyThemeAndFlags();
    syncQuickPanel();
    scheduleScan();
    OzonMD3Ext.saveStoredSettings(currentSettings);
  }

  function createIcon(key, size = 18) {
    if (window.OzonMD3Icons) return OzonMD3Icons.createIconSvgElement(key, size);
    const svg = document.createElementNS(SVG_NS, 'svg');
    return svg;
  }

  function ensureQuickStudio() {
    if (!currentSettings.enabled || currentSettings.floatingStudio === false || !document.body) {
      removeQuickStudio();
      return;
    }

    let fab = document.getElementById('ozmd3-fab');
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'ozmd3-fab';
      fab.type = 'button';
      fab.className = 'ozmd3-no-scale';
      fab.title = 'Параметры Ozon MD3';
      fab.setAttribute('aria-label', 'Параметры Ozon MD3');
      fab.appendChild(createIcon('tune', 20));
      const lbl = document.createElement('span');
      lbl.textContent = 'Параметры';
      fab.appendChild(lbl);

      fab.addEventListener('click', () => {
        quickPanelOpen = !quickPanelOpen;
        fab.classList.remove('is-scroll-hidden');
        const p = document.getElementById('ozmd3-quick-panel');
        if (p) p.classList.toggle('is-open', quickPanelOpen);
      });
      document.body.appendChild(fab);
    }

    setupFabScrollAutoHide();

    if (!document.getElementById('ozmd3-quick-panel')) {
      buildQuickPanel();
    }
    syncQuickPanel();
  }

  function setupFabScrollAutoHide() {
    if (scrollHideBound) return;
    scrollHideBound = true;
    lastScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    window.addEventListener('scroll', () => {
      const fab = document.getElementById('ozmd3-fab');
      if (!fab) return;
      const curY = window.scrollY || document.documentElement.scrollTop || 0;
      const delta = curY - lastScrollY;

      if (quickPanelOpen || curY <= 48) {
        fab.classList.remove('is-scroll-hidden');
      } else if (delta > 6) {
        fab.classList.add('is-scroll-hidden');
      } else if (delta < -6) {
        fab.classList.remove('is-scroll-hidden');
      }
      lastScrollY = curY;
    }, { passive: true });
  }

  function getActiveTargetHex() {
    if (quickColorTarget === 'text') {
      return OzonMD3Color.isValidHex(currentSettings.customTextColor)
        ? currentSettings.customTextColor
        : (resolveIsDark() ? '#E6E0E9' : '#1D1B20');
    }
    if (quickColorTarget === 'button') {
      return OzonMD3Color.isValidHex(currentSettings.customButtonColor)
        ? currentSettings.customButtonColor
        : currentSettings.seedColor;
    }
    return currentSettings.seedColor;
  }

  function getTargetPatch(hex) {
    if (quickColorTarget === 'text') return { customTextColor: hex };
    if (quickColorTarget === 'button') return { customButtonColor: hex };
    return { seedColor: hex };
  }

  function buildQuickPanel() {
    const panel = document.createElement('aside');
    panel.id = 'ozmd3-quick-panel';
    panel.setAttribute('aria-label', 'Быстрые настройки Ozon MD3');

    // Header
    const head = document.createElement('div');
    head.className = 'ozmd3-qp-head';
    const title = document.createElement('div');
    title.className = 'ozmd3-qp-title';
    title.textContent = 'Ozon MD3 Expressive';
    const adBadge = document.createElement('span');
    adBadge.className = 'ozmd3-qp-badge';
    adBadge.id = 'ozmd3-qp-ads-badge';
    head.appendChild(title);
    head.appendChild(adBadge);
    panel.appendChild(head);

    // RGB Box
    const rgbBox = document.createElement('div');
    rgbBox.className = 'ozmd3-qp-box';

    const rgbHead = document.createElement('div');
    rgbHead.className = 'ozmd3-qp-row-head';
    const rgbLbl = document.createElement('span');
    rgbLbl.textContent = 'Палитра RGB';
    const hexOut = document.createElement('span');
    hexOut.id = 'ozmd3-qp-hex';
    rgbHead.appendChild(rgbLbl);
    rgbHead.appendChild(hexOut);
    rgbBox.appendChild(rgbHead);

    const tabs = document.createElement('div');
    tabs.className = 'ozmd3-qp-tabs';
    [
      { id: 'accent', label: 'Акцент' },
      { id: 'text', label: 'Текст' },
      { id: 'button', label: 'Кнопки' }
    ].forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ozmd3-qp-tab ozmd3-no-scale';
      b.dataset.target = t.id;
      b.textContent = t.label;
      b.addEventListener('click', () => {
        quickColorTarget = t.id;
        syncQuickPanel();
      });
      tabs.appendChild(b);
    });
    rgbBox.appendChild(tabs);

    const chState = { r: 103, g: 80, b: 164 };
    ['r', 'g', 'b'].forEach(ch => {
      const row = document.createElement('div');
      row.className = 'ozmd3-qp-slider-row';
      const tag = document.createElement('span');
      tag.textContent = ch.toUpperCase();
      tag.style.fontWeight = '700';

      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = '0';
      inp.max = '255';
      inp.dataset.ch = ch;

      const val = document.createElement('span');
      val.className = 'ozmd3-qp-val';
      val.id = `ozmd3-qp-val-${ch}`;

      inp.addEventListener('input', () => {
        panel.querySelectorAll('input[data-ch]').forEach(el => {
          chState[el.dataset.ch] = Number(el.value);
        });
        const hex = OzonMD3Color.rgbToHex(chState.r, chState.g, chState.b);
        currentSettings = mergeSettings(Object.assign({}, currentSettings, getTargetPatch(hex)));
        applyThemeAndFlags();
        syncQuickPanel();
      });
      inp.addEventListener('change', () => {
        OzonMD3Ext.saveStoredSettings(currentSettings);
      });

      row.appendChild(tag);
      row.appendChild(inp);
      row.appendChild(val);
      rgbBox.appendChild(row);
    });

    const presets = document.createElement('div');
    presets.className = 'ozmd3-qp-presets';
    OzonMD3Color.COLOR_PRESETS.forEach(p => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'ozmd3-qp-dot ozmd3-no-scale';
      dot.style.background = p.seed;
      dot.title = p.name;
      dot.dataset.seed = p.seed;
      dot.addEventListener('click', () => {
        persistPatch(getTargetPatch(p.seed));
      });
      presets.appendChild(dot);
    });
    rgbBox.appendChild(presets);
    panel.appendChild(rgbBox);

    // Shape & Button Size Box
    const uiBox = document.createElement('div');
    uiBox.className = 'ozmd3-qp-box';
    const uiHead = document.createElement('div');
    uiHead.className = 'ozmd3-qp-row-head';
    uiHead.textContent = 'Скругление и Размер кнопок';
    uiBox.appendChild(uiHead);

    [
      { key: 'cornerRadius', label: 'Углы', min: 0, max: 36, step: 1, fmt: v => `${v}px` },
      { key: 'buttonScale', label: 'Кнопки', min: 75, max: 140, step: 5, fmt: v => `${v}%`, scale100: true }
    ].forEach(cfg => {
      const row = document.createElement('div');
      row.className = 'ozmd3-qp-slider-row';
      const tag = document.createElement('span');
      tag.textContent = cfg.label;
      tag.style.fontSize = '11px';

      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = String(cfg.min);
      inp.max = String(cfg.max);
      inp.step = String(cfg.step);
      inp.dataset.uiKey = cfg.key;

      const val = document.createElement('span');
      val.className = 'ozmd3-qp-val';
      val.id = `ozmd3-qp-ui-${cfg.key}`;

      inp.addEventListener('input', () => {
        const raw = Number(inp.value);
        const valToSave = cfg.scale100 ? raw / 100 : raw;
        currentSettings = mergeSettings(Object.assign({}, currentSettings, { [cfg.key]: valToSave }));
        applyThemeAndFlags();
        val.textContent = cfg.fmt(raw);
      });
      inp.addEventListener('change', () => {
        OzonMD3Ext.saveStoredSettings(currentSettings);
      });

      row.appendChild(tag);
      row.appendChild(inp);
      row.appendChild(val);
      uiBox.appendChild(row);
    });

    panel.appendChild(uiBox);
    document.body.appendChild(panel);
  }

  function syncQuickPanel() {
    const panel = document.getElementById('ozmd3-quick-panel');
    if (!panel) return;

    const adCount = window.OzonMD3AdBlock ? OzonMD3AdBlock.getBlockedCount() : 0;
    const badge = document.getElementById('ozmd3-qp-ads-badge');
    if (badge) badge.textContent = `Реклама: -${adCount}`;

    panel.querySelectorAll('.ozmd3-qp-tab').forEach(b => {
      b.classList.toggle('is-active', b.dataset.target === quickColorTarget);
    });

    const hex = getActiveTargetHex();
    const hexEl = document.getElementById('ozmd3-qp-hex');
    if (hexEl) hexEl.textContent = hex.toUpperCase();

    const [r, g, b] = OzonMD3Color.hexToRgb(hex);
    const map = { r, g, b };
    panel.querySelectorAll('input[data-ch]').forEach(inp => {
      const v = map[inp.dataset.ch];
      inp.value = String(v);
      const out = document.getElementById(`ozmd3-qp-val-${inp.dataset.ch}`);
      if (out) out.textContent = String(v);
    });

    panel.querySelectorAll('.ozmd3-qp-dot').forEach(dot => {
      dot.classList.toggle('is-active', dot.dataset.seed.toLowerCase() === hex.toLowerCase());
    });

    const radInp = panel.querySelector('input[data-ui-key="cornerRadius"]');
    if (radInp) {
      const rad = Math.round(Number(currentSettings.cornerRadius) || 20);
      radInp.value = String(rad);
      const out = document.getElementById('ozmd3-qp-ui-cornerRadius');
      if (out) out.textContent = `${rad}px`;
    }

    const btnInp = panel.querySelector('input[data-ui-key="buttonScale"]');
    if (btnInp) {
      const pct = Math.round((Number(currentSettings.buttonScale) || 1) * 100);
      btnInp.value = String(pct);
      const out = document.getElementById('ozmd3-qp-ui-buttonScale');
      if (out) out.textContent = `${pct}%`;
    }
  }

  /* ============================================================================
     DOM Scan & Lifecycle Observers
     ============================================================================ */
  function scanDom(rootEl) {
    if (!currentSettings.enabled) return;
    const scope = rootEl || document;

    if (window.OzonMD3AdBlock) {
      OzonMD3AdBlock.scanAndHideAds(scope, currentSettings);
    }

    classifyOzonElements(scope);

    if (window.OzonMD3Icons) {
      if (currentSettings.rewriteIcons !== false) {
        OzonMD3Icons.scanAndRewriteIcons(scope);
      } else {
        OzonMD3Icons.restoreOriginalIcons(scope);
      }
    }

    if (window.OzonMD3Transitions) {
      OzonMD3Transitions.checkHrefChanged();
      OzonMD3Transitions.staggerCardsInViewport(scope);
    }

    if (document.body) {
      ensureQuickStudio();
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanDom(document);
    }, 85);
  }

  function isIgnoredMutation(node) {
    if (!node || node.nodeType !== 1) return false;
    const id = node.id || '';
    if (id.startsWith('ozmd3-')) return true;
    if (node.classList && (
      node.classList.contains('ozmd3-icon-svg') ||
      node.classList.contains('ozmd3-ripple-wave')
    )) return true;
    return false;
  }

  function startObservers() {
    if (!domObserver && document.documentElement) {
      domObserver = new MutationObserver(mutations => {
        if (!currentSettings.enabled) return;
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (m.target && m.target.closest && m.target.closest('#ozmd3-quick-panel, #ozmd3-fab, #ozmd3-nav-progress')) {
            continue;
          }
          if (m.addedNodes && m.addedNodes.length > 0) {
            for (let j = 0; j < m.addedNodes.length; j++) {
              if (!isIgnoredMutation(m.addedNodes[j])) {
                scheduleScan();
                return;
              }
            }
          }
        }
      });

      domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq && typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', () => {
          if (currentSettings.themeMode === 'auto') applyThemeAndFlags();
        });
      }
    }
  }

  async function init() {
    const stored = await OzonMD3Ext.getStoredSettings();
    currentSettings = mergeSettings(stored);
    applyThemeAndFlags();

    if (window.OzonMD3Transitions) {
      OzonMD3Transitions.setupNavigationListeners();
      OzonMD3Transitions.setupRippleListener();
    }
    startObservers();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyThemeAndFlags();
        scanDom(document);
        if (window.OzonMD3Transitions) OzonMD3Transitions.consumePendingMpaEnter();
      }, { once: true });
    } else {
      scanDom(document);
      if (window.OzonMD3Transitions) OzonMD3Transitions.consumePendingMpaEnter();
    }

    // Periodic lightweight sweep for virtual-scroll product tiles on infinite scroll
    let scrollTimer = null;
    window.addEventListener('scroll', () => {
      if (!currentSettings.enabled) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => scanDom(document), 140);
    }, { passive: true });
  }

  OzonMD3Ext.addStorageListener(newVal => {
    currentSettings = mergeSettings(newVal);
    applyThemeAndFlags();
    syncQuickPanel();
    scheduleScan();
  });

  OzonMD3Ext.addMessageListener(msg => {
    if (!msg || typeof msg.type !== 'string') return false;
    if (msg.type === 'PREVIEW_SETTINGS' || msg.type === 'APPLY_SETTINGS') {
      currentSettings = mergeSettings(Object.assign({}, currentSettings, msg.payload || {}));
      applyThemeAndFlags();
      syncQuickPanel();
      scheduleScan();
      return { ok: true, blockedAds: window.OzonMD3AdBlock ? OzonMD3AdBlock.getBlockedCount() : 0 };
    }
    if (msg.type === 'GET_STATUS') {
      return {
        ok: true,
        blockedAds: window.OzonMD3AdBlock ? OzonMD3AdBlock.getBlockedCount() : 0
      };
    }
    return false;
  });

  init();
})();
