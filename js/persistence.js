// persistence.js — UMD: <script> clásico en el navegador (define
// window.RetiroPersistence) y módulo CommonJS en Node.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RetiroPersistence = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const KEY_STATE = 'retiro:estado';
  const KEY_SCENARIOS = 'retiro:escenarios';

  // --- Serialización para URL (funciones puras, testeables sin navegador) ---

  // Codifica inputs a base64 (compatible navegador y Node).
  function encodeState(inputs) {
    const json = JSON.stringify(inputs);
    if (typeof btoa === 'function') {
      // Idioma moderno unicode-safe (sin escape/unescape deprecados).
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

  // --- localStorage (sólo navegador; no-ops si no existe) ---

  function saveState(inputs) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY_STATE, JSON.stringify(inputs));
  }

  function loadState() {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY_STATE);
    return raw ? JSON.parse(raw) : null;
  }

  function saveScenarios(list) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY_SCENARIOS, JSON.stringify(list));
  }

  function loadScenarios() {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY_SCENARIOS);
    return raw ? JSON.parse(raw) : [];
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
