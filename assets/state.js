/* Storage is optional: calculators must work when the browser blocks it. */
(() => {
  'use strict';

  function createStateStore(getStorage, key) {
    return {
      read() {
        try {
          const value = JSON.parse(getStorage().getItem(key));
          return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        } catch {
          return {};
        }
      },
      write(value) {
        try {
          getStorage().setItem(key, JSON.stringify(value));
        } catch {
          // Calculation and navigation remain available without persistence.
        }
      },
    };
  }

  function restoreControls(controls, data) {
    for (const control of controls) {
      if (!Object.hasOwn(data, control.id)) continue;
      const value = data[control.id];
      if (control.type === 'checkbox') {
        if (typeof value === 'boolean') control.checked = value;
      } else if (typeof value === 'string') {
        if (control.tagName !== 'SELECT' || [...control.options].some((option) => option.value === value)) {
          control.value = value;
        }
      }
    }
  }

  const api = { createStateStore, restoreControls };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.QuickCalcState = api;
})();
