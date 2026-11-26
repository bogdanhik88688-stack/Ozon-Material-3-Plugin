/**
 * Ozon Material 3 Expressive — Complete Ad & Banner Removal Engine.
 * Eliminates:
 *  - All ad banners, hero carousels, promo strips, stories, and marketing widgets
 *  - Mandatory Russian ad-law marked blocks ("Реклама", "Рекламное место", erid tokens)
 *  - Sponsored/promoted product cards in search & shelves
 *  - App-install nag bars, cookie/promo popups, and empty leftover row wrappers
 */
(function (root) {
  'use strict';

  const AD_WIDGET_RE = /(^|[-_.])(adv|advert|advertising|adfox|marketad|promo|promobanner|searchbanner|brandbanner|herobanner|digitalmainhero|stories|teaser|billboard|marketing|rtb|stickybanner|appinstall|downloadapp|cookiemodal|pushprompt|popupbanner)/i;
  const SAFE_WIDGET_RE = /^(header|search|catalog|breadcrumbs|paginator|searchresultsv2|catalogresults|skugrid|skushelf|skushelfgoods|skuline|webproductheading|webprice|websale|webaddtocart|webcharacteristics|webreviews|cart|checkout|footer|useravatar|profile|container)/i;
  const AD_BADGE_TEXT_RE = /^(реклама|рекламное\s+место|спонсорский\s+товар|продвигается|информация\s+о\s+рекламодателе|erid\s*[:：]\s*[a-z0-9_-]+)$/i;
  const APP_NAG_TEXT_RE = /^(удобнее в приложении|скачайте приложение|открыть в приложении|установите приложение\s+ozon)/i;
  const PROMO_HREF_RE = /(\berid=|\/highlight\/|\/landing\/|\/action\/|\/special\/|finance\.ozon|travel\.ozon|bank\.ozon)/i;

  let blockedElements = new WeakSet();
  let blockedCount = 0;

  function markHidden(el, reason) {
    if (!el || !el.isConnected) return false;
    if (el.closest('#ozmd3-quick-panel, #ozmd3-fab')) return false;
    // Never hide core shell or safe grid/product widgets
    if (el === document.body || el === document.documentElement || el.id === 'layoutPage') return false;
    if (el.matches('header, nav, main, footer, [data-widget="header"], [data-widget="search"], [data-widget="catalog"], [data-widget="searchResultsV2"], [data-widget="catalogResults"], [data-widget="skuGrid"]')) {
      return false;
    }
    const ownWidget = el.getAttribute && el.getAttribute('data-widget');
    if (ownWidget && SAFE_WIDGET_RE.test(ownWidget)) return false;

    if (el.getAttribute('data-ozmd3-ad-hidden') !== '1') {
      el.setAttribute('data-ozmd3-ad-hidden', '1');
      if (reason) el.setAttribute('data-ozmd3-ad-reason', reason);
      if (!blockedElements.has(el)) {
        blockedElements.add(el);
        blockedCount += 1;
      }
      return true;
    }
    return false;
  }

  function findEnclosingCard(el) {
    return el.closest('div[data-index], .tile-root, article, [data-widget="skuGrid"] > div, [data-widget="skuShelfGoods"] > div > div');
  }

  function findEnclosingWidgetOrBannerRow(el) {
    const widget = el.closest('[data-widget]');
    if (widget) {
      const wName = widget.getAttribute('data-widget') || '';
      if (!SAFE_WIDGET_RE.test(wName)) return widget;
    }
    // Walk up while parent only wraps this single banner subtree (never past safe widgets)
    let cur = el;
    for (let i = 0; i < 4 && cur && cur.parentElement; i++) {
      const p = cur.parentElement;
      if (p === document.body || p.id === 'layoutPage' || p.matches('main, header, footer')) break;
      const pWidget = p.getAttribute && p.getAttribute('data-widget');
      if (pWidget && SAFE_WIDGET_RE.test(pWidget)) break;
      if (p.children.length === 1) cur = p;
      else break;
    }
    const curWidget = cur && cur.getAttribute && cur.getAttribute('data-widget');
    if (curWidget && SAFE_WIDGET_RE.test(curWidget)) return null;
    return cur;
  }

  function hasProductContent(el) {
    if (!el) return false;
    if (el.querySelector('[data-widget="webPrice"], [data-widget="webSale"], [data-index], .tile-root')) return true;
    const text = el.textContent || '';
    // Product cards contain ₽ currency price and /product/ links
    if (/₽/.test(text) && el.querySelector('a[href*="/product/"]')) return true;
    return false;
  }

  function isLikelyPromoBannerWidget(widget) {
    if (!widget) return false;
    const wName = widget.getAttribute('data-widget') || '';
    if (SAFE_WIDGET_RE.test(wName)) return false;

    const isProductPage = /\/product\//i.test(window.location.pathname);
    if (isProductPage && /webGallery/i.test(wName)) return false;

    // Explicit ad / banner / promo / stories widget names
    if (AD_WIDGET_RE.test(wName)) return true;

    // Carousel / CMS / ObjectLine / Banner widgets that are promotional (not product shelves)
    if (/(banner|carousel|slider|cms|objectline|gallery|action|promo|hero)/i.test(wName)) {
      if (hasProductContent(widget)) return false;
      const imgs = widget.querySelectorAll('img, picture');
      if (imgs.length === 0) return false;
      // Check if wide banner image or promo link exists
      const hasPromoLink = Boolean(widget.querySelector('a[href]')) && Array.from(widget.querySelectorAll('a[href]')).some(a => {
        const href = a.getAttribute('href') || '';
        return PROMO_HREF_RE.test(href) || (!href.includes('/product/') && a.querySelector('img'));
      });
      if (hasPromoLink) {
        // Guard against category navigation icon grids (small square thumbnails <= 110px with short text labels)
        const wideImg = Array.from(imgs).some(img => {
          const r = img.getBoundingClientRect();
          return r.width >= 260 && r.height >= 45;
        });
        if (wideImg || /banner|carousel|slider|hero|stories|promo/i.test(wName)) {
          return true;
        }
      }
    }
    return false;
  }

  function collapseEmptyContainers() {
    const layoutRoot = document.querySelector('#layoutPage, main') || document.body;
    if (!layoutRoot) return;
    const hiddenNodes = layoutRoot.querySelectorAll('[data-ozmd3-ad-hidden="1"]');
    for (let i = 0; i < hiddenNodes.length; i++) {
      let parent = hiddenNodes[i].parentElement;
      for (let depth = 0; depth < 3 && parent && parent !== layoutRoot && parent !== document.body; depth++) {
        if (parent.matches('header, nav, main, footer, [data-widget="searchResultsV2"], [data-widget="catalogResults"]')) {
          break;
        }
        let hasVisibleChild = false;
        const children = parent.children;
        for (let c = 0; c < children.length; c++) {
          const ch = children[c];
          if (ch.getAttribute('data-ozmd3-ad-hidden') !== '1' && ch.tagName !== 'STYLE' && ch.tagName !== 'SCRIPT') {
            const txt = (ch.textContent || '').trim();
            if (txt.length > 0 || ch.querySelector('img, svg, input, button, a')) {
              hasVisibleChild = true;
              break;
            }
          }
        }
        if (!hasVisibleChild) {
          parent.setAttribute('data-ozmd3-ad-wrapper-hidden', '1');
          parent = parent.parentElement;
        } else {
          break;
        }
      }
    }
  }

  function scanAndHideAds(rootEl, options = {}) {
    if (options.blockAds === false) {
      restoreAds(document);
      return;
    }

    const blockSponsored = options.blockSponsoredCards !== false;
    const blockBanners = options.blockPromoBanners !== false;
    const scope = rootEl && rootEl.querySelectorAll ? rootEl : document;

    // 1. Direct erid & ad-link markers
    const eridEls = scope.querySelectorAll('a[href*="erid="], [data-erid], [data-ad], [data-adv], [class*="advBanner" i], [class*="reklama" i]');
    for (let i = 0; i < eridEls.length; i++) {
      const el = eridEls[i];
      if (el.getAttribute('data-ozmd3-ad-hidden') === '1') continue;
      const card = findEnclosingCard(el);
      if (card) {
        if (blockSponsored) markHidden(card, 'erid-card');
      } else if (blockBanners) {
        markHidden(findEnclosingWidgetOrBannerRow(el), 'erid-banner');
      }
    }

    // 2. Ozon [data-widget] banners, carousels, stories & promo containers
    if (blockBanners) {
      const widgets = scope.querySelectorAll('[data-widget]');
      for (let i = 0; i < widgets.length; i++) {
        const w = widgets[i];
        if (w.getAttribute('data-ozmd3-ad-hidden') === '1') continue;
        if (isLikelyPromoBannerWidget(w)) {
          markHidden(w, 'widget-' + (w.getAttribute('data-widget') || 'banner'));
        }
      }

      // Standalone wide hero/promo banner images outside product cards & galleries
      const wideBanners = scope.querySelectorAll('a[href*="/highlight/"] img, a[href*="/action/"] img, a[href*="/landing/"] img, a[href*="finance.ozon"] img, a[href*="bank.ozon"] img');
      for (let i = 0; i < wideBanners.length; i++) {
        const img = wideBanners[i];
        if (img.closest('[data-ozmd3-ad-hidden="1"], header, nav, [data-widget="catalog"]')) continue;
        const rect = img.getBoundingClientRect();
        if (rect.width >= 260 && rect.height >= 45 && !img.closest('[data-index], .tile-root')) {
          markHidden(findEnclosingWidgetOrBannerRow(img), 'promo-img-link');
        }
      }
    }

    // 3. Text badges ("Реклама", "Рекламное место", "erid:", app-download banners)
    const leafCandidates = scope.querySelectorAll('span, div, p, a, button');
    for (let i = 0; i < leafCandidates.length; i++) {
      const el = leafCandidates[i];
      if (el.childElementCount > 1) continue;
      if (el.closest('#ozmd3-quick-panel, #ozmd3-fab, [data-ozmd3-ad-hidden="1"]')) continue;

      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt || txt.length > 80) continue;

      if (txt.length <= 42 && AD_BADGE_TEXT_RE.test(txt)) {
        const card = findEnclosingCard(el);
        if (card) {
          if (blockSponsored) markHidden(card, 'sponsored-badge');
        } else if (blockBanners) {
          markHidden(findEnclosingWidgetOrBannerRow(el), 'ad-badge-banner');
        }
        continue;
      }

      if (blockBanners && APP_NAG_TEXT_RE.test(txt)) {
        const nag = el.closest('[data-widget], [role="dialog"], section, aside') || findEnclosingWidgetOrBannerRow(el);
        if (nag && !nag.matches('header, main, footer')) {
          markHidden(nag, 'app-nag');
        }
      }
    }

    // 4. Sticky bottom / corner floating promotional overlays (non-modal essential UI preserved)
    if (blockBanners) {
      const fixedEls = scope.querySelectorAll('aside, [class*="sticky" i], [class*="floating" i]');
      for (let i = 0; i < fixedEls.length; i++) {
        const f = fixedEls[i];
        if (f.closest('#ozmd3-quick-panel, #ozmd3-fab, header, [data-widget="header"], [data-widget="cart"]')) continue;
        const txt = (f.textContent || '').trim();
        if (/реклама|erid|ozon\s*банк|рассрочк|установите приложение/i.test(txt) && f.getBoundingClientRect().height < 260) {
          markHidden(f, 'sticky-promo');
        }
      }
    }

    collapseEmptyContainers();
  }

  function restoreAds(rootEl) {
    const scope = rootEl && rootEl.querySelectorAll ? rootEl : document;
    scope.querySelectorAll('[data-ozmd3-ad-hidden="1"]').forEach(el => {
      el.removeAttribute('data-ozmd3-ad-hidden');
      el.removeAttribute('data-ozmd3-ad-reason');
    });
    scope.querySelectorAll('[data-ozmd3-ad-wrapper-hidden="1"]').forEach(el => {
      el.removeAttribute('data-ozmd3-ad-wrapper-hidden');
    });
  }

  function getBlockedCount() {
    return blockedCount;
  }

  root.OzonMD3AdBlock = {
    scanAndHideAds,
    restoreAds,
    getBlockedCount
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
