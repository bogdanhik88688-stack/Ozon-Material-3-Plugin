/**
 * Ozon Material 3 Expressive — Cross-Browser Popup Controller.
 * Syncs live RGB Accent/Text/Button colors, corner rounding, UI sizes,
 * ad-blocker rulesets & Expressive animations across open Ozon tabs.
 */
(function () {
  'use strict';

  let settings = Object.assign({}, OzonMD3Color.DEFAULT_SETTINGS);
  let activeRgbTarget = 'accent'; // 'accent' | 'text' | 'button'
  let saveDebounce = null;

  const $ = id => document.getElementById(id);

  function mergeSettings(raw) {
    return Object.assign({}, OzonMD3Color.DEFAULT_SETTINGS, raw && typeof raw === 'object' ? raw : {});
  }

  function resolvePopupDark() {
    if (settings.themeMode === 'light') return false;
    if (settings.themeMode === 'dark') return true;
    return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
  }

  function applyPopupTheme() {
    const isDark = resolvePopupDark();
    const scheme = OzonMD3Color.generateScheme({
      seedColor: settings.seedColor,
      isDark,
      schemeStyle: settings.schemeStyle,
      contrastLevel: settings.contrastLevel,
      amoled: settings.amoled,
      fullAccentFill: settings.fullAccentFill !== false
    });
    const vars = OzonMD3Color.schemeToCssVariables(scheme, settings);
    const rootStyle = document.documentElement.style;
    Object.keys(vars).forEach(k => rootStyle.setProperty(k, vars[k]));

    // Drive live preview geometry inside popup
    rootStyle.setProperty('--preview-radius', `${Math.round(Number(settings.cornerRadius) || 20)}px`);
    rootStyle.setProperty('--preview-btn-scale', String(Number(settings.buttonScale) || 1));
  }

  async function broadcastPreview(partial) {
    const tabs = await OzonMD3Ext.queryOzonTabs();
    await Promise.all(tabs.map(t => OzonMD3Ext.sendMessageToTab(t.id, {
      type: 'PREVIEW_SETTINGS',
      payload: partial
    })));
  }

  async function fetchBlockedAdsCount() {
    const tabs = await OzonMD3Ext.queryOzonTabs();
    let maxBlocked = 0;
    for (const t of tabs) {
      const res = await OzonMD3Ext.sendMessageToTab(t.id, { type: 'GET_STATUS' });
      if (res && typeof res.blockedAds === 'number' && res.blockedAds > maxBlocked) {
        maxBlocked = res.blockedAds;
      }
    }
    const chip = $('preview-chip-ads');
    if (chip) chip.textContent = `Реклама: -${maxBlocked}`;
    const badge = $('badge-ads-blocked');
    if (badge) {
      badge.textContent = settings.blockAds !== false
        ? (maxBlocked > 0 ? `Скрыто: ${maxBlocked}` : 'Активно')
        : 'Выкл';
    }
  }

  function getActiveTargetHex() {
    if (activeRgbTarget === 'text') {
      return OzonMD3Color.isValidHex(settings.customTextColor)
        ? settings.customTextColor
        : (resolvePopupDark() ? '#E6E0E9' : '#1D1B20');
    }
    if (activeRgbTarget === 'button') {
      return OzonMD3Color.isValidHex(settings.customButtonColor)
        ? settings.customButtonColor
        : settings.seedColor;
    }
    return settings.seedColor;
  }

  function getTargetPatch(hex) {
    if (activeRgbTarget === 'text') return { customTextColor: hex };
    if (activeRgbTarget === 'button') return { customButtonColor: hex };
    return { seedColor: hex };
  }

  function updateSliderVisual(sliderWrap, value, min, max, labelText) {
    if (!sliderWrap) return;
    const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
    sliderWrap.style.setProperty('--pct', String(pct));
    sliderWrap.classList.toggle('is-at-max', pct >= 0.96);
    const tip = sliderWrap.querySelector('.m3-slider-tooltip');
    if (tip) tip.textContent = labelText !== undefined ? labelText : String(value);
  }

  function updateSetting(partial, immediateSave = true) {
    settings = mergeSettings(Object.assign({}, settings, partial));
    applyPopupTheme();
    syncUi();
    broadcastPreview(partial);

    if ('enabled' in partial) {
      OzonMD3Ext.updateActionBadge(settings.enabled !== false);
    }
    if ('blockAds' in partial || 'enabled' in partial) {
      OzonMD3Ext.syncAdblockRuleset(settings.enabled !== false && settings.blockAds !== false);
    }

    clearTimeout(saveDebounce);
    if (immediateSave) {
      OzonMD3Ext.saveStoredSettings(settings);
    } else {
      saveDebounce = setTimeout(() => {
        OzonMD3Ext.saveStoredSettings(settings);
      }, 120);
    }
  }

  function syncUi() {
    $('toggle-enabled').checked = settings.enabled !== false;

    const rad = Math.round(Number(settings.cornerRadius) ?? 20);
    const btnPct = Math.round((Number(settings.buttonScale) || 1) * 100);
    const fontPct = Math.round((Number(settings.fontScale) || 1) * 100);
    const iconPx = Math.round(Number(settings.iconSize) || 22);

    $('preview-sub').textContent = `Углы ${rad}px • Кнопки ${btnPct}% • ${settings.seedColor.toUpperCase()}`;

    // Theme mode + Full Accent Fill + AMOLED
    document.querySelectorAll('#theme-mode-group .seg-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.theme === settings.themeMode);
    });
    $('btn-full-accent').classList.toggle('is-active', settings.fullAccentFill !== false);
    $('btn-amoled').classList.toggle('is-active', Boolean(settings.amoled));

    // RGB Target
    document.querySelectorAll('#rgb-target-group .seg-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.rgbTarget === activeRgbTarget);
    });
    const autoBtn = $('btn-target-auto');
    if (activeRgbTarget === 'accent') {
      autoBtn.style.display = 'none';
    } else {
      autoBtn.style.display = 'inline-block';
      const isAuto = activeRgbTarget === 'text'
        ? !OzonMD3Color.isValidHex(settings.customTextColor)
        : !OzonMD3Color.isValidHex(settings.customButtonColor);
      autoBtn.classList.toggle('is-active', isAuto);
    }

    // RGB Sliders
    const targetHex = getActiveTargetHex();
    const [r, g, b] = OzonMD3Color.hexToRgb(targetHex);
    $('slider-r').value = String(r);
    $('slider-g').value = String(g);
    $('slider-b').value = String(b);
    $('val-r').textContent = String(r);
    $('val-g').textContent = String(g);
    $('val-b').textContent = String(b);
    updateSliderVisual(document.querySelector('[data-channel="r"]'), r, 0, 255);
    updateSliderVisual(document.querySelector('[data-channel="g"]'), g, 0, 255);
    updateSliderVisual(document.querySelector('[data-channel="b"]'), b, 0, 255);

    if (document.activeElement !== $('hex-input')) {
      $('hex-input').value = targetHex.toUpperCase();
    }
    $('rgb-preview-dot').style.background = targetHex;

    document.querySelectorAll('.preset-dot').forEach(dot => {
      dot.classList.toggle('is-active', dot.dataset.seed.toLowerCase() === targetHex.toLowerCase());
    });

    // Scheme Style
    document.querySelectorAll('#scheme-style-group .filter-chip').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.scheme === settings.schemeStyle);
    });

    // Corner Radius & Interface Sliders
    $('slider-radius').value = String(rad);
    $('badge-radius').textContent = `${rad}px`;
    updateSliderVisual($('slider-wrap-radius'), rad, 0, 36, `${rad}px`);

    $('slider-btn-scale').value = String(btnPct);
    $('val-btn-scale').textContent = `${btnPct}%`;
    updateSliderVisual($('slider-wrap-btn-scale'), btnPct, 75, 140, `${btnPct}%`);

    $('slider-font-scale').value = String(fontPct);
    $('val-font-scale').textContent = `${fontPct}%`;
    updateSliderVisual($('slider-wrap-font-scale'), fontPct, 85, 125, `${fontPct}%`);

    $('slider-icon-size').value = String(iconPx);
    $('val-icon-size').textContent = `${iconPx}px`;
    updateSliderVisual($('slider-wrap-icon-size'), iconPx, 14, 30, `${iconPx}px`);

    document.querySelectorAll('#density-group .seg-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.density === settings.uiDensity);
    });

    // Switches
    $('sw-rewrite-icons').checked = settings.rewriteIcons !== false;
    $('sw-tonal-cards').checked = settings.tonalCards !== false;
    $('sw-md3-font').checked = settings.md3Font !== false;
    $('sw-price-badges').checked = settings.priceBadges !== false;
    $('sw-floating-studio').checked = settings.floatingStudio !== false;

    $('sw-block-ads').checked = settings.blockAds !== false;
    $('sw-block-banners').checked = settings.blockPromoBanners !== false;
    $('sw-block-sponsored').checked = settings.blockSponsoredCards !== false;

    document.querySelectorAll('#hover-anim-group .filter-chip').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.hover === settings.cardHoverAnim);
    });

    $('sw-page-transitions').checked = settings.pageTransitions !== false;
    document.querySelectorAll('#trans-style-group .seg-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.transStyle === settings.transitionStyle);
    });
    document.querySelectorAll('#trans-speed-group .seg-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.transSpeed === settings.transitionSpeed);
    });
    $('sw-ripple').checked = settings.rippleEffect !== false;
  }

  function renderStaticIconsAndPresets() {
    $('brand-badge').appendChild(OzonMD3Icons.createIconSvgElement('shopping_bag', 20));
    $('master-thumb-icon').appendChild(OzonMD3Icons.createIconSvgElement('check', 14));
    $('preview-bag-icon').appendChild(OzonMD3Icons.createIconSvgElement('shopping_cart-fill', 24));
    $('preview-chip-fav').appendChild(OzonMD3Icons.createIconSvgElement('favorite-fill', 14));
    $('reset-icon-slot').appendChild(OzonMD3Icons.createIconSvgElement('replay', 18));

    const tabMeta = [
      { id: 'tab-btn-colors', icon: 'palette', label: 'Цвета' },
      { id: 'tab-btn-layout', icon: 'tune', label: 'Углы и UI' },
      { id: 'tab-btn-motion', icon: 'bolt-fill', label: 'Анимации' }
    ];
    tabMeta.forEach(t => {
      const btn = $(t.id);
      btn.appendChild(OzonMD3Icons.createIconSvgElement(t.icon, 16));
      const sp = document.createElement('span');
      sp.textContent = t.label;
      btn.appendChild(sp);
    });

    const showcase = $('icons-showcase');
    ['apps', 'search', 'shopping_cart', 'favorite-fill', 'inventory_2', 'local_shipping', 'location_on', 'star-fill', 'person'].forEach(k => {
      showcase.appendChild(OzonMD3Icons.createIconSvgElement(k, 20));
    });

    const presetWrap = $('preset-dots');
    OzonMD3Color.COLOR_PRESETS.forEach(p => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'preset-dot';
      dot.dataset.seed = p.seed;
      dot.title = p.name;
      dot.style.backgroundColor = p.seed;
      dot.addEventListener('click', () => updateSetting(getTargetPatch(p.seed), true));
      presetWrap.appendChild(dot);
    });
  }

  function bindDraggingBehavior(sliderEl) {
    if (!sliderEl) return;
    const inp = sliderEl.querySelector('input[type="range"]');
    if (!inp) return;
    inp.addEventListener('pointerdown', () => sliderEl.classList.add('is-dragging'));
    const end = () => sliderEl.classList.remove('is-dragging');
    inp.addEventListener('pointerup', end);
    inp.addEventListener('pointercancel', end);
    inp.addEventListener('blur', end);
  }

  function bindEvents() {
    $('toggle-enabled').addEventListener('change', e => updateSetting({ enabled: e.target.checked }, true));

    // Tabs
    document.querySelectorAll('.m3-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.m3-tab').forEach(t => {
          const active = t.dataset.tab === target;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', String(active));
        });
        document.querySelectorAll('.tab-panel').forEach(p => {
          p.classList.toggle('is-active', p.dataset.panel === target);
        });
      });
    });

    // Theme, Full Accent Fill & AMOLED
    document.querySelectorAll('#theme-mode-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => updateSetting({ themeMode: btn.dataset.theme }, true));
    });
    $('btn-full-accent').addEventListener('click', () => updateSetting({ fullAccentFill: !(settings.fullAccentFill !== false) }, true));
    $('btn-amoled').addEventListener('click', () => updateSetting({ amoled: !settings.amoled }, true));

    // RGB Target & Sliders
    document.querySelectorAll('#rgb-target-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeRgbTarget = btn.dataset.rgbTarget;
        syncUi();
      });
    });
    $('btn-target-auto').addEventListener('click', () => {
      if (activeRgbTarget === 'text') updateSetting({ customTextColor: null }, true);
      else if (activeRgbTarget === 'button') updateSetting({ customButtonColor: null }, true);
    });

    const handleRgbInput = immediate => {
      const hex = OzonMD3Color.rgbToHex(
        Number($('slider-r').value),
        Number($('slider-g').value),
        Number($('slider-b').value)
      );
      updateSetting(getTargetPatch(hex), immediate);
    };
    ['slider-r', 'slider-g', 'slider-b'].forEach(id => {
      const inp = $(id);
      bindDraggingBehavior(inp.closest('.m3-expressive-slider'));
      inp.addEventListener('input', () => handleRgbInput(false));
      inp.addEventListener('change', () => handleRgbInput(true));
    });

    $('hex-input').addEventListener('input', e => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (OzonMD3Color.isValidHex(val)) {
        updateSetting(getTargetPatch(val.toUpperCase()), false);
      }
    });

    // Scheme Style
    document.querySelectorAll('#scheme-style-group .filter-chip').forEach(btn => {
      btn.addEventListener('click', () => updateSetting({ schemeStyle: btn.dataset.scheme }, true));
    });

    // Corner Radius & UI Customization Sliders
    const bindRangeSetting = (inputId, wrapId, settingKey, divisor = 1) => {
      const inp = $(inputId);
      bindDraggingBehavior($(wrapId));
      inp.addEventListener('input', () => updateSetting({ [settingKey]: Number(inp.value) / divisor }, false));
      inp.addEventListener('change', () => updateSetting({ [settingKey]: Number(inp.value) / divisor }, true));
    };
    bindRangeSetting('slider-radius', 'slider-wrap-radius', 'cornerRadius', 1);
    bindRangeSetting('slider-btn-scale', 'slider-wrap-btn-scale', 'buttonScale', 100);
    bindRangeSetting('slider-font-scale', 'slider-wrap-font-scale', 'fontScale', 100);
    bindRangeSetting('slider-icon-size', 'slider-wrap-icon-size', 'iconSize', 1);

    document.querySelectorAll('#density-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => updateSetting({ uiDensity: btn.dataset.density }, true));
    });

    // Switches
    const bindSwitch = (id, key) => {
      $(id).addEventListener('change', e => updateSetting({ [key]: e.target.checked }, true));
    };
    bindSwitch('sw-rewrite-icons', 'rewriteIcons');
    bindSwitch('sw-tonal-cards', 'tonalCards');
    bindSwitch('sw-md3-font', 'md3Font');
    bindSwitch('sw-price-badges', 'priceBadges');
    bindSwitch('sw-floating-studio', 'floatingStudio');
    bindSwitch('sw-block-ads', 'blockAds');
    bindSwitch('sw-block-banners', 'blockPromoBanners');
    bindSwitch('sw-block-sponsored', 'blockSponsoredCards');
    bindSwitch('sw-page-transitions', 'pageTransitions');
    bindSwitch('sw-ripple', 'rippleEffect');

    document.querySelectorAll('#hover-anim-group .filter-chip').forEach(btn => {
      btn.addEventListener('click', () => updateSetting({ cardHoverAnim: btn.dataset.hover }, true));
    });
    document.querySelectorAll('#trans-style-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => updateSetting({ transitionStyle: btn.dataset.transStyle }, true));
    });
    document.querySelectorAll('#trans-speed-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => updateSetting({ transitionSpeed: btn.dataset.transSpeed }, true));
    });

    $('btn-reset').addEventListener('click', () => {
      activeRgbTarget = 'accent';
      updateSetting(Object.assign({}, OzonMD3Color.DEFAULT_SETTINGS), true);
    });
  }

  async function init() {
    renderStaticIconsAndPresets();
    bindEvents();
    const stored = await OzonMD3Ext.getStoredSettings();
    settings = mergeSettings(stored);
    applyPopupTheme();
    syncUi();
    fetchBlockedAdsCount();
  }

  init();
})();
