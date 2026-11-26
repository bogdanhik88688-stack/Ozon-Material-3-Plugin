/**
 * Material Design 3 Expressive — Perceptual OKLab / HCT Color Role Engine
 * + Global Shape Scale, UI Density & Expressive Spring Motion Tokens for Ozon.
 */
(function (root) {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    themeMode: 'auto',            // 'auto' | 'dark' | 'light'
    amoled: false,
    fullAccentFill: true,         // Full site accent surface coloring (no half-white blocks)
    seedColor: '#6750A4',         // RGB Accent seed
    customTextColor: null,        // null (Auto MD3) | '#RRGGBB'
    customButtonColor: null,      // null (Auto MD3) | '#RRGGBB'
    schemeStyle: 'expressive',    // 'tonalSpot' | 'vibrant' | 'expressive' | 'fidelity' | 'monochrome'
    contrastLevel: 'standard',    // 'standard' | 'medium' | 'high'
    cornerRadius: 20,             // 0..36 px — regulates all rounded corners across Ozon
    buttonScale: 1.0,             // 0.75..1.40 — button sizing customization
    fontScale: 1.0,               // 0.85..1.25 — interface text scaling
    iconSize: 22,                 // 14..30 px
    uiDensity: 'comfortable',     // 'compact' | 'comfortable' | 'spacious'
    md3Font: true,
    tonalCards: true,
    priceBadges: true,            // Tonal MD3 badges behind product prices
    rippleEffect: true,
    cardHoverAnim: 'spring',      // 'spring' | 'morph' | 'tilt' | 'minimal' | 'off'
    pageTransitions: true,
    transitionStyle: 'shared-axis', // 'shared-axis' | 'morph-lift' | 'slide-x'
    transitionSpeed: 'default',   // 'fast' (350ms) | 'default' (500ms) | 'slow' (650ms)
    rewriteIcons: true,
    blockAds: true,
    blockSponsoredCards: true,
    blockPromoBanners: true,
    floatingStudio: true
  });

  const COLOR_PRESETS = Object.freeze([
    { id: 'm3-purple',  name: 'Material Purple',  seed: '#6750A4' },
    { id: 'ozon-blue',  name: 'Ozon Cobalt MD3',  seed: '#005BFF' },
    { id: 'pixel-blue', name: 'Pixel Ocean',      seed: '#1B6EF3' },
    { id: 'rose-pink',  name: 'Expressive Rose',  seed: '#D81B60' },
    { id: 'sage-green', name: 'Forest Sage',      seed: '#146C2E' },
    { id: 'amber-sun',  name: 'Amber Sunset',     seed: '#C4511B' },
    { id: 'teal-cyan',  name: 'Teal Cyan',        seed: '#006A6A' },
    { id: 'slate-mono', name: 'Neutral Slate',    seed: '#5F5E62' }
  ]);

  const schemeCache = new Map();

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function srgbToLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(c) {
    c = clamp01(c);
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(clamp01(v) * 255);
  }

  function hexToRgb(hex) {
    const clean = String(hex || '#6750A4').trim().replace(/^#/, '');
    const full = clean.length === 3
      ? clean.split('').map(ch => ch + ch).join('')
      : clean.padEnd(6, '0').slice(0, 6);
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return [103, 80, 164];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  function hexToRgba(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function isValidHex(hex) {
    return typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex.trim());
  }

  function linearRgbToOklab(r, g, b) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  function oklabToLinearRgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    return [
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
  }

  function inSrgbGamut(r, g, b) {
    return r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;
  }

  function relativeLuminance(r, g, b) {
    return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
  }

  function toneToLuminance(tone) {
    const t = Math.max(0, Math.min(100, tone));
    return t <= 8 ? t / 903.296296 : Math.pow((t + 16) / 116, 3);
  }

  function hexToOklch(hex) {
    const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
    const [L, oa, ob] = linearRgbToOklab(r, g, b);
    const C = Math.hypot(oa, ob);
    let H = (Math.atan2(ob, oa) * 180) / Math.PI;
    if (H < 0) H += 360;
    return { L, C, H };
  }

  function hctToneToHex(hueDeg, targetChroma, tone) {
    if (tone <= 0.1) return '#000000';
    if (tone >= 99.9) return '#ffffff';

    const rad = (hueDeg * Math.PI) / 180;
    const cosH = Math.cos(rad);
    const sinH = Math.sin(rad);
    const targetY = toneToLuminance(tone);

    function fitChroma(L_ok) {
      let rgb = oklabToLinearRgb(L_ok, targetChroma * cosH, targetChroma * sinH);
      if (inSrgbGamut(rgb[0], rgb[1], rgb[2])) return rgb;
      let lo = 0;
      let hi = targetChroma;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) * 0.5;
        const test = oklabToLinearRgb(L_ok, mid * cosH, mid * sinH);
        if (inSrgbGamut(test[0], test[1], test[2])) lo = mid;
        else hi = mid;
      }
      return oklabToLinearRgb(L_ok, lo * cosH, lo * sinH);
    }

    let loL = 0;
    let hiL = 1;
    let bestRgb = [0, 0, 0];
    for (let i = 0; i < 16; i++) {
      const midL = (loL + hiL) * 0.5;
      const rgb = fitChroma(midL);
      const y = relativeLuminance(rgb[0], rgb[1], rgb[2]);
      bestRgb = rgb;
      if (y < targetY) loL = midL;
      else hiL = midL;
    }

    return rgbToHex(
      linearToSrgb(bestRgb[0]),
      linearToSrgb(bestRgb[1]),
      linearToSrgb(bestRgb[2])
    );
  }

  function wrapHue(h) {
    return ((h % 360) + 360) % 360;
  }

  function buildPalettes(seedHex, schemeStyle, fullAccentFill) {
    const seed = hexToOklch(seedHex);
    const H = seed.H;
    const baseC = seed.C;
    const tintBoost = fullAccentFill && baseC >= 0.015;

    if (schemeStyle === 'monochrome' || baseC < 0.015) {
      return {
        primary:        t => hctToneToHex(H, 0.008, t),
        secondary:      t => hctToneToHex(H, 0.006, t),
        tertiary:       t => hctToneToHex(H, 0.012, t),
        neutral:        t => hctToneToHex(H, 0.004, t),
        neutralVariant: t => hctToneToHex(H, 0.006, t),
        error:          t => hctToneToHex(27, 0.175, t)
      };
    }

    if (schemeStyle === 'vibrant') {
      return {
        primary:        t => hctToneToHex(H, Math.max(baseC, 0.17), t),
        secondary:      t => hctToneToHex(wrapHue(H + 12), 0.085, t),
        tertiary:       t => hctToneToHex(wrapHue(H + 45), 0.13, t),
        neutral:        t => hctToneToHex(H, tintBoost ? 0.068 : 0.018, t),
        neutralVariant: t => hctToneToHex(H, tintBoost ? 0.092 : 0.032, t),
        error:          t => hctToneToHex(27, 0.19, t)
      };
    }

    if (schemeStyle === 'expressive') {
      const nHue = wrapHue(H + 10);
      return {
        primary:        t => hctToneToHex(wrapHue(H + 15), Math.max(baseC, 0.155), t),
        secondary:      t => hctToneToHex(wrapHue(H - 120), 0.075, t),
        tertiary:       t => hctToneToHex(wrapHue(H + 120), 0.12, t),
        neutral:        t => hctToneToHex(nHue, tintBoost ? 0.062 : 0.016, t),
        neutralVariant: t => hctToneToHex(nHue, tintBoost ? 0.086 : 0.030, t),
        error:          t => hctToneToHex(27, 0.185, t)
      };
    }

    if (schemeStyle === 'fidelity') {
      return {
        primary:        t => hctToneToHex(H, Math.max(baseC, 0.18), t),
        secondary:      t => hctToneToHex(H, Math.max(baseC * 0.48, 0.06), t),
        tertiary:       t => hctToneToHex(wrapHue(H + 35), Math.max(baseC * 0.72, 0.10), t),
        neutral:        t => hctToneToHex(H, tintBoost ? 0.064 : 0.015, t),
        neutralVariant: t => hctToneToHex(H, tintBoost ? 0.088 : 0.028, t),
        error:          t => hctToneToHex(27, 0.185, t)
      };
    }

    // Default MD3 Tonal Spot
    return {
      primary:        t => hctToneToHex(H, Math.max(Math.min(baseC, 0.19), 0.125), t),
      secondary:      t => hctToneToHex(H, 0.052, t),
      tertiary:       t => hctToneToHex(wrapHue(H + 60), 0.085, t),
      neutral:        t => hctToneToHex(H, tintBoost ? 0.056 : 0.013, t),
      neutralVariant: t => hctToneToHex(H, tintBoost ? 0.078 : 0.025, t),
      error:          t => hctToneToHex(27, 0.18, t)
    };
  }

  function generateScheme(options = {}) {
    const seedColor = isValidHex(options.seedColor) ? options.seedColor : DEFAULT_SETTINGS.seedColor;
    const isDark = options.isDark !== undefined ? Boolean(options.isDark) : false;
    const schemeStyle = options.schemeStyle || DEFAULT_SETTINGS.schemeStyle;
    const contrastLevel = options.contrastLevel || 'standard';
    const amoled = Boolean(options.amoled);
    const fullAccentFill = options.fullAccentFill !== undefined ? Boolean(options.fullAccentFill) : true;

    const cacheKey = `${seedColor}|${isDark}|${schemeStyle}|${contrastLevel}|${amoled}|${fullAccentFill}`;
    if (schemeCache.has(cacheKey)) {
      return schemeCache.get(cacheKey);
    }

    const p = buildPalettes(seedColor, schemeStyle, fullAccentFill);
    const cBoost = contrastLevel === 'high' ? 1 : contrastLevel === 'medium' ? 0.5 : 0;

    let roles;
    if (isDark) {
      const surfT = amoled ? 0 : (fullAccentFill ? 9 : 6);
      const lowestT = amoled ? 0 : (fullAccentFill ? 6 : 4);
      const lowT = amoled ? 7 : (fullAccentFill ? 13 : 10);
      const baseT = amoled ? 11 : (fullAccentFill ? 16 : 12);
      const highT = amoled ? 15 : (fullAccentFill ? 21 : 17);
      const highestT = amoled ? 20 : (fullAccentFill ? 26 : 22);
      const primaryT = schemeStyle === 'fidelity' ? 74 + 6 * cBoost : 80 + 6 * cBoost;

      roles = {
        primary: p.primary(primaryT),
        onPrimary: p.primary(20 - 12 * cBoost),
        primaryContainer: p.primary(32 + 6 * cBoost),
        onPrimaryContainer: p.primary(90 + 6 * cBoost),

        secondary: p.secondary(80 + 6 * cBoost),
        onSecondary: p.secondary(20 - 12 * cBoost),
        secondaryContainer: p.secondary(30 + 6 * cBoost),
        onSecondaryContainer: p.secondary(90 + 6 * cBoost),

        tertiary: p.tertiary(80 + 6 * cBoost),
        onTertiary: p.tertiary(20 - 12 * cBoost),
        tertiaryContainer: p.tertiary(30 + 6 * cBoost),
        onTertiaryContainer: p.tertiary(90 + 6 * cBoost),

        error: p.error(80 + 6 * cBoost),
        onError: p.error(20 - 12 * cBoost),
        errorContainer: p.error(30 + 6 * cBoost),
        onErrorContainer: p.error(90 + 6 * cBoost),

        background: p.neutral(surfT),
        onBackground: p.neutral(92 + 6 * cBoost),
        surface: p.neutral(surfT),
        onSurface: p.neutral(92 + 6 * cBoost),
        surfaceDim: p.neutral(surfT),
        surfaceBright: p.neutral(26 + 4 * cBoost),

        surfaceContainerLowest: p.neutral(lowestT),
        surfaceContainerLow: p.neutral(lowT),
        surfaceContainer: p.neutral(baseT),
        surfaceContainerHigh: p.neutral(highT),
        surfaceContainerHighest: p.neutral(highestT),

        surfaceVariant: p.neutralVariant(30),
        onSurfaceVariant: p.neutralVariant(80 + 10 * cBoost),
        outline: p.neutralVariant(60 + 14 * cBoost),
        outlineVariant: p.neutralVariant(32 + 14 * cBoost),

        inverseSurface: p.neutral(90),
        inverseOnSurface: p.neutral(20),
        inversePrimary: p.primary(40),
        scrim: '#000000',
        shadow: '#000000'
      };
    } else {
      const surfT = fullAccentFill ? 91 : 98;
      const lowestT = fullAccentFill ? 94 : 100;
      const lowT = fullAccentFill ? 89 : 96;
      const baseT = fullAccentFill ? 86 : 94;
      const highT = fullAccentFill ? 83 : 92;
      const highestT = fullAccentFill ? 79 : 90;

      roles = {
        primary: p.primary(40 - 14 * cBoost),
        onPrimary: p.primary(100),
        primaryContainer: p.primary(fullAccentFill ? 85 - 8 * cBoost : 90 - 8 * cBoost),
        onPrimaryContainer: p.primary(10 - 6 * cBoost),

        secondary: p.secondary(40 - 14 * cBoost),
        onSecondary: p.secondary(100),
        secondaryContainer: p.secondary(fullAccentFill ? 84 - 8 * cBoost : 90 - 8 * cBoost),
        onSecondaryContainer: p.secondary(10 - 6 * cBoost),

        tertiary: p.tertiary(40 - 14 * cBoost),
        onTertiary: p.tertiary(100),
        tertiaryContainer: p.tertiary(fullAccentFill ? 85 - 8 * cBoost : 90 - 8 * cBoost),
        onTertiaryContainer: p.tertiary(10 - 6 * cBoost),

        error: p.error(40 - 14 * cBoost),
        onError: p.error(100),
        errorContainer: p.error(90 - 8 * cBoost),
        onErrorContainer: p.error(10 - 6 * cBoost),

        background: p.neutral(surfT),
        onBackground: p.neutral(10 - 6 * cBoost),
        surface: p.neutral(surfT),
        onSurface: p.neutral(10 - 6 * cBoost),
        surfaceDim: p.neutral(82 - 6 * cBoost),
        surfaceBright: p.neutral(fullAccentFill ? 93 : 98),

        surfaceContainerLowest: p.neutral(lowestT),
        surfaceContainerLow: p.neutral(lowT),
        surfaceContainer: p.neutral(baseT),
        surfaceContainerHigh: p.neutral(highT),
        surfaceContainerHighest: p.neutral(highestT),

        surfaceVariant: p.neutralVariant(fullAccentFill ? 84 : 90),
        onSurfaceVariant: p.neutralVariant(28 - 12 * cBoost),
        outline: p.neutralVariant(48 - 16 * cBoost),
        outlineVariant: p.neutralVariant(fullAccentFill ? 72 - 16 * cBoost : 80 - 20 * cBoost),

        inverseSurface: p.neutral(20),
        inverseOnSurface: p.neutral(95),
        inversePrimary: p.primary(80),
        scrim: '#000000',
        shadow: '#000000'
      };
    }

    const result = { isDark, seedColor, schemeStyle, roles };
    schemeCache.set(cacheKey, result);
    if (schemeCache.size > 40) {
      const firstKey = schemeCache.keys().next().value;
      schemeCache.delete(firstKey);
    }
    return result;
  }

  function getContrastForeground(hex) {
    const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
    const y = relativeLuminance(r, g, b);
    return y > 0.34 ? '#111116' : '#FFFFFF';
  }

  function schemeToCssVariables(scheme, settings = {}) {
    const r = scheme.roles;
    const isDark = scheme.isDark;
    const rawText = settings.customTextColor;
    const rawBtn = settings.customButtonColor;
    const hasCustomText = isValidHex(rawText);
    const hasCustomBtn = isValidHex(rawBtn);

    const textPrimary = hasCustomText ? rawText.trim() : r.onSurface;
    const textSecondary = hasCustomText ? hexToRgba(textPrimary, 0.74) : r.onSurfaceVariant;
    const textMuted = hasCustomText ? hexToRgba(textPrimary, 0.56) : hexToRgba(r.onSurfaceVariant, 0.8);

    const btnBg = hasCustomBtn ? rawBtn.trim() : r.primary;
    const btnFg = hasCustomBtn ? getContrastForeground(btnBg) : r.onPrimary;
    const btnHoverBg = hasCustomBtn ? hexToRgba(btnBg, 0.86) : r.primaryContainer;
    const btnHoverFg = hasCustomBtn ? btnFg : r.onPrimaryContainer;

    // Shape Scale from user's Corner Radius slider (0..36px)
    const radius = clamp(
      settings.cornerRadius !== undefined ? Number(settings.cornerRadius) : DEFAULT_SETTINGS.cornerRadius,
      0,
      36
    );
    const rXs = radius <= 1 ? radius : Math.max(2, Math.round(radius * 0.32));
    const rSm = radius <= 1 ? radius : Math.max(3, Math.round(radius * 0.55));
    const rMd = radius <= 1 ? radius : Math.max(4, Math.round(radius * 0.8));
    const rLg = Math.round(radius);
    const rXl = radius <= 1 ? radius : Math.round(radius * 1.4);
    const rBtn = radius <= 2 ? radius : Math.round(radius * 1.25);
    const rPill = radius <= 2 ? radius : (radius >= 14 ? 9999 : Math.round(radius * 1.6));

    // UI Customization Scales
    const btnScale = clamp(Number(settings.buttonScale) || 1.0, 0.75, 1.40);
    const fontScale = clamp(Number(settings.fontScale) || 1.0, 0.85, 1.25);
    const iconSize = clamp(Number(settings.iconSize) || 22, 14, 30);

    const density = settings.uiDensity || 'comfortable';
    const densityGap = density === 'compact' ? '8px' : density === 'spacious' ? '18px' : '12px';
    const densityPad = density === 'compact' ? '8px' : density === 'spacious' ? '16px' : '12px';

    // Expressive Motion Speeds
    const speed = settings.transitionSpeed || 'default';
    const transDuration = speed === 'fast' ? '350ms' : speed === 'slow' ? '650ms' : '500ms';
    const transCurve = speed === 'fast'
      ? 'cubic-bezier(0.42, 1.67, 0.21, 0.90)'
      : speed === 'slow'
        ? 'cubic-bezier(0.39, 1.29, 0.35, 0.98)'
        : 'cubic-bezier(0.38, 1.21, 0.22, 1.00)';

    const [pr, pg, pb] = hexToRgb(r.primary);
    const [tr, tg, tb] = hexToRgb(r.tertiary);
    const [sr, sg, sb] = hexToRgb(r.surface);
    const [osr, osg, osb] = hexToRgb(textPrimary);

    return {
      // Official MD3 System Color Tokens
      '--md-sys-color-primary': r.primary,
      '--md-sys-color-primary-rgb': `${pr}, ${pg}, ${pb}`,
      '--md-sys-color-on-primary': r.onPrimary,
      '--md-sys-color-primary-container': r.primaryContainer,
      '--md-sys-color-on-primary-container': r.onPrimaryContainer,
      '--md-sys-color-secondary': r.secondary,
      '--md-sys-color-on-secondary': r.onSecondary,
      '--md-sys-color-secondary-container': r.secondaryContainer,
      '--md-sys-color-on-secondary-container': r.onSecondaryContainer,
      '--md-sys-color-tertiary': r.tertiary,
      '--md-sys-color-tertiary-rgb': `${tr}, ${tg}, ${tb}`,
      '--md-sys-color-on-tertiary': r.onTertiary,
      '--md-sys-color-tertiary-container': r.tertiaryContainer,
      '--md-sys-color-on-tertiary-container': r.onTertiaryContainer,
      '--md-sys-color-error': r.error,
      '--md-sys-color-on-error': r.onError,
      '--md-sys-color-error-container': r.errorContainer,
      '--md-sys-color-on-error-container': r.onErrorContainer,
      '--md-sys-color-background': r.background,
      '--md-sys-color-on-background': textPrimary,
      '--md-sys-color-surface': r.surface,
      '--md-sys-color-surface-rgb': `${sr}, ${sg}, ${sb}`,
      '--md-sys-color-on-surface': textPrimary,
      '--md-sys-color-on-surface-rgb': `${osr}, ${osg}, ${osb}`,
      '--md-sys-color-surface-dim': r.surfaceDim,
      '--md-sys-color-surface-bright': r.surfaceBright,
      '--md-sys-color-surface-container-lowest': r.surfaceContainerLowest,
      '--md-sys-color-surface-container-low': r.surfaceContainerLow,
      '--md-sys-color-surface-container': r.surfaceContainer,
      '--md-sys-color-surface-container-high': r.surfaceContainerHigh,
      '--md-sys-color-surface-container-highest': r.surfaceContainerHighest,
      '--md-sys-color-surface-variant': r.surfaceVariant,
      '--md-sys-color-on-surface-variant': textSecondary,
      '--md-sys-color-outline': r.outline,
      '--md-sys-color-outline-variant': r.outlineVariant,
      '--md-sys-color-inverse-surface': r.inverseSurface,
      '--md-sys-color-inverse-on-surface': r.inverseOnSurface,
      '--md-sys-color-inverse-primary': r.inversePrimary,

      // Material 3 Expressive Motion Tokens
      '--md-motion-spring-fast-spatial': 'cubic-bezier(0.42, 1.67, 0.21, 0.90)',
      '--md-motion-spring-default-spatial': 'cubic-bezier(0.38, 1.21, 0.22, 1.00)',
      '--md-motion-spring-slow-spatial': 'cubic-bezier(0.39, 1.29, 0.35, 0.98)',
      '--md-motion-spring-fast-effects': 'cubic-bezier(0.31, 0.94, 0.34, 1.00)',
      '--md-motion-spring-default-effects': 'cubic-bezier(0.34, 0.80, 0.34, 1.00)',
      '--md-motion-spring-slow-effects': 'cubic-bezier(0.34, 0.88, 0.34, 1.00)',
      '--ozmd3-trans-duration': transDuration,
      '--ozmd3-trans-curve': transCurve,

      // MD3 State Layers
      '--md-sys-state-hover': hexToRgba(textPrimary, 0.08),
      '--md-sys-state-focus': hexToRgba(textPrimary, 0.12),
      '--md-sys-state-pressed': hexToRgba(textPrimary, 0.14),
      '--md-sys-state-primary-hover': hexToRgba(r.primary, 0.12),

      // Ozon Custom Role Tokens
      '--ozmd3-text-primary': textPrimary,
      '--ozmd3-text-secondary': textSecondary,
      '--ozmd3-text-muted': textMuted,
      '--ozmd3-btn-bg': btnBg,
      '--ozmd3-btn-fg': btnFg,
      '--ozmd3-btn-hover-bg': btnHoverBg,
      '--ozmd3-btn-hover-fg': btnHoverFg,
      '--ozmd3-tonal-btn-bg': r.secondaryContainer,
      '--ozmd3-tonal-btn-fg': r.onSecondaryContainer,
      '--ozmd3-glass-header': hexToRgba(r.surfaceContainerLow, isDark ? 0.88 : 0.90),

      // Global Shape Scale Tokens
      '--ozmd3-radius-base': `${rLg}px`,
      '--ozmd3-radius-xs': `${rXs}px`,
      '--ozmd3-radius-sm': `${rSm}px`,
      '--ozmd3-radius-md': `${rMd}px`,
      '--ozmd3-radius-lg': `${rLg}px`,
      '--ozmd3-radius-xl': `${rXl}px`,
      '--ozmd3-radius-btn': `${rBtn}px`,
      '--ozmd3-radius-pill': rPill === 9999 ? '9999px' : `${rPill}px`,

      // UI Customization Scale Tokens
      '--ozmd3-btn-scale': String(btnScale),
      '--ozmd3-btn-pad-y': `${(8 * btnScale).toFixed(1)}px`,
      '--ozmd3-btn-pad-x': `${(16 * btnScale).toFixed(1)}px`,
      '--ozmd3-btn-min-h': `${(38 * btnScale).toFixed(1)}px`,
      '--ozmd3-btn-font': `${(14 * btnScale).toFixed(1)}px`,
      '--ozmd3-font-scale': String(fontScale),
      '--ozmd3-icon-size': `${iconSize}px`,
      '--ozmd3-density-gap': densityGap,
      '--ozmd3-density-pad': densityPad,

      // Map Ozon Native Design System Variables if present
      '--bgPrimary': r.surface,
      '--bgSecondary': r.surfaceContainerLow,
      '--bgTertiary': r.surfaceContainer,
      '--textPrimary': textPrimary,
      '--textSecondary': textSecondary,
      '--ctrlPrimary': btnBg,
      '--ctrlSecondary': r.secondaryContainer
    };
  }

  root.OzonMD3Color = {
    DEFAULT_SETTINGS,
    COLOR_PRESETS,
    generateScheme,
    schemeToCssVariables,
    hexToRgba,
    hexToRgb,
    rgbToHex,
    isValidHex,
    getContrastForeground
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
