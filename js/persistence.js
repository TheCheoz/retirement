// persistence.js — UMD: classic <script> in the browser (defines
// window.RetirementPersistence) and a CommonJS module in Node.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RetirementPersistence = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const KEY_STATE = 'retirement:state';
  const KEY_SCENARIOS = 'retirement:scenarios';

  // --- URL serialization (pure functions, testable without a browser) ---

  // Encodes inputs to base64 (works in both browser and Node).
  function encodeState(inputs) {
    const json = JSON.stringify(inputs);
    if (typeof btoa === 'function') {
      // Modern unicode-safe idiom (no deprecated escape/unescape).
      const bytes = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      return btoa(bytes);
    }
    return Buffer.from(json, 'utf-8').toString('base64');
  }

  function decodeState(encoded) {
    if (!encoded) return null;
    try {
      let json;
      if (typeof atob === 'function') {
        const bytes = atob(encoded);
        json = decodeURIComponent(Array.from(bytes, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
      } else {
        json = Buffer.from(encoded, 'base64').toString('utf-8');
      }
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  // --- localStorage (browser only; no-ops if unavailable) ---

  // Firefox throws SecurityError just *touching* localStorage on file://, so a
  // `typeof localStorage` guard isn't enough — every access must be wrapped.
  function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; }
    catch { return null; }
  }

  function saveState(inputs) {
    const ls = storage();
    if (!ls) return;
    try { ls.setItem(KEY_STATE, JSON.stringify(inputs)); } catch {}
  }

  function loadState() {
    const ls = storage();
    if (!ls) return null;
    try {
      const raw = ls.getItem(KEY_STATE);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveScenarios(list) {
    const ls = storage();
    if (!ls) return;
    try { ls.setItem(KEY_SCENARIOS, JSON.stringify(list)); } catch {}
  }

  function loadScenarios() {
    const ls = storage();
    if (!ls) return [];
    try {
      const raw = ls.getItem(KEY_SCENARIOS);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  // --- URL hash ---

  function readStateFromHash() {
    if (typeof location === 'undefined') return null;
    return decodeState(location.hash.replace(/^#/, ''));
  }

  function writeStateToHash(inputs) {
    if (typeof location === 'undefined') return;
    location.hash = encodeState(inputs);
  }

  return {
    encodeState, decodeState, saveState, loadState,
    saveScenarios, loadScenarios, readStateFromHash, writeStateToHash,
  };
});
