/**
 * Cross-Browser WebExtension API Compatibility Layer.
 * Unifies Promise-based `browser.*` (Firefox / Safari) and callback/Promise `chrome.*`
 * (Chrome / Edge / Yandex Browser / Opera / Brave / Vivaldi / Arc) APIs.
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'ozonMd3Settings';
  const hasBrowserNs = typeof globalThis !== 'undefined' && typeof globalThis.browser !== 'undefined';
  const rawApi = hasBrowserNs
    ? globalThis.browser
    : (typeof globalThis !== 'undefined' && typeof globalThis.chrome !== 'undefined' ? globalThis.chrome : null);

  function callApi(obj, method, ...args) {
    return new Promise((resolve, reject) => {
      if (!obj || typeof obj[method] !== 'function') {
        resolve(undefined);
        return;
      }
      try {
        if (hasBrowserNs) {
          Promise.resolve(obj[method](...args)).then(resolve, reject);
          return;
        }
        let settled = false;
        const ret = obj[method](...args, res => {
          settled = true;
          const err = rawApi && rawApi.runtime ? rawApi.runtime.lastError : null;
          if (err) reject(new Error(err.message || String(err)));
          else resolve(res);
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(res => {
            if (!settled) resolve(res);
          }, err => {
            if (!settled) reject(err);
          });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  async function getStoredSettings() {
    if (!rawApi || !rawApi.storage) return null;
    try {
      if (rawApi.storage.sync) {
        const synced = await callApi(rawApi.storage.sync, 'get', STORAGE_KEY);
        if (synced && synced[STORAGE_KEY]) return synced[STORAGE_KEY];
      }
    } catch (_) {
      // Fallback to storage.local (e.g., Firefox temporary add-on without gecko id)
    }
    try {
      if (rawApi.storage.local) {
        const local = await callApi(rawApi.storage.local, 'get', STORAGE_KEY);
        if (local && local[STORAGE_KEY]) return local[STORAGE_KEY];
      }
    } catch (_) {
      // Ignore storage errors in restricted contexts
    }
    return null;
  }

  async function saveStoredSettings(nextSettings) {
    if (!rawApi || !rawApi.storage) return;
    const payload = { [STORAGE_KEY]: nextSettings };
    if (rawApi.storage.local) {
      try {
        await callApi(rawApi.storage.local, 'set', payload);
      } catch (_) {
        // Ignore
      }
    }
    if (rawApi.storage.sync) {
      try {
        await callApi(rawApi.storage.sync, 'set', payload);
      } catch (_) {
        // Ignore sync failure when browser sync is disabled or unsigned add-on
      }
    }
  }

  function addStorageListener(handler) {
    if (!rawApi || !rawApi.storage || !rawApi.storage.onChanged) return;
    rawApi.storage.onChanged.addListener((changes, area) => {
      if ((area === 'sync' || area === 'local') && changes && changes[STORAGE_KEY]) {
        handler(changes[STORAGE_KEY].newValue, area);
      }
    });
  }

  function addMessageListener(handler) {
    if (!rawApi || !rawApi.runtime || !rawApi.runtime.onMessage) return;
    rawApi.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      try {
        const result = handler(msg, sender);
        if (result && typeof result.then === 'function') {
          result.then(res => {
            try { sendResponse(res); } catch (_) {}
          }).catch(() => {
            try { sendResponse({ ok: false }); } catch (_) {}
          });
          return true;
        }
        if (result !== undefined && result !== false) {
          try { sendResponse(result); } catch (_) {}
          return true;
        }
      } catch (_) {
        // Ignore listener errors
      }
      return false;
    });
  }

  async function queryOzonTabs() {
    if (!rawApi || !rawApi.tabs) return [];
    const patterns = [
      'https://*.ozon.ru/*',
      'https://ozon.ru/*',
      'https://*.ozon.by/*',
      'https://ozon.by/*',
      'https://*.ozon.kz/*',
      'https://ozon.kz/*'
    ];
    try {
      const tabs = await callApi(rawApi.tabs, 'query', { url: patterns });
      return Array.isArray(tabs) ? tabs : [];
    } catch (_) {
      try {
        const all = await callApi(rawApi.tabs, 'query', {});
        return Array.isArray(all)
          ? all.filter(t => t && typeof t.url === 'string' && /^https:\/\/([^/]+\.)?ozon\.(ru|by|kz)\//i.test(t.url))
          : [];
      } catch (_) {
        return [];
      }
    }
  }

  async function sendMessageToTab(tabId, message) {
    if (!rawApi || !rawApi.tabs || tabId == null) return null;
    try {
      return await callApi(rawApi.tabs, 'sendMessage', tabId, message);
    } catch (_) {
      return null;
    }
  }

  async function updateActionBadge(enabled) {
    if (!rawApi || !rawApi.action) return;
    try {
      await callApi(rawApi.action, 'setBadgeText', { text: enabled ? '' : 'OFF' });
      if (!enabled && rawApi.action.setBadgeBackgroundColor) {
        await callApi(rawApi.action, 'setBadgeBackgroundColor', { color: '#49454F' });
      }
    } catch (_) {
      // Ignore on browsers without action badge support
    }
  }

  async function syncAdblockRuleset(enabled) {
    if (!rawApi || !rawApi.declarativeNetRequest || typeof rawApi.declarativeNetRequest.updateEnabledRulesets !== 'function') {
      return;
    }
    try {
      await callApi(rawApi.declarativeNetRequest, 'updateEnabledRulesets', enabled
        ? { enableRulesetIds: ['ozon_adblock_rules'] }
        : { disableRulesetIds: ['ozon_adblock_rules'] }
      );
    } catch (_) {
      // Ignore if ruleset toggle is unsupported in host browser
    }
  }

  root.OzonMD3Ext = {
    STORAGE_KEY,
    raw: rawApi,
    getStoredSettings,
    saveStoredSettings,
    addStorageListener,
    addMessageListener,
    queryOzonTabs,
    sendMessageToTab,
    updateActionBadge,
    syncAdblockRuleset
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
