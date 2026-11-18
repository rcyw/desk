(() => {
  const key = 'desk:reading-preferences';
  const minimum = 90;
  const maximum = 150;
  const step = 10;
  const root = document.documentElement;

  function readPreferences() {
    const defaults = { size: 100, theme: 'light' };
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
      const size = saved?.size;
      const validSize = Number.isInteger(size) && size >= minimum && size <= maximum && size % step === 0;
      return {
        size: validSize ? size : defaults.size,
        theme: saved?.theme === 'dark' ? 'dark' : defaults.theme,
      };
    } catch {
      return defaults;
    }
  }

  let preferences = readPreferences();

  function applyPreferences() {
    root.dataset.readingTheme = preferences.theme;
    root.style.setProperty('--reading-scale', String(preferences.size / 100));
    document.dispatchEvent(new Event('reading-preferences-change'));
  }

  function reloadPreferences() {
    preferences = readPreferences();
    applyPreferences();
  }

  applyPreferences();
  document.addEventListener('astro:after-swap', applyPreferences);

  window.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) reloadPreferences();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) reloadPreferences();
  });

  class ReadingControls extends HTMLElement {
    connectedCallback() {
      this.addEventListener('click', this.handleClick);
      document.addEventListener('reading-preferences-change', this.sync);
      this.sync();
      this.hidden = false;
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.handleClick);
      document.removeEventListener('reading-preferences-change', this.sync);
    }

    sync = () => {
      this.querySelector('[data-size-step="-1"]').setAttribute('aria-disabled', String(preferences.size === minimum));
      this.querySelector('[data-size-step="1"]').setAttribute('aria-disabled', String(preferences.size === maximum));
      const status = this.querySelector('[data-size-status]');
      const label = `Text size ${preferences.size}%`;
      if (status.textContent !== label) status.textContent = label;

      for (const button of this.querySelectorAll('[data-theme-option]')) {
        button.setAttribute('aria-pressed', String(button.dataset.themeOption === preferences.theme));
      }
    };

    handleClick = (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest('button');
      if (!button || button.getAttribute('aria-disabled') === 'true') return;
      if (button.dataset.sizeStep) {
        preferences.size += Number(button.dataset.sizeStep) * step;
      } else if (button.dataset.themeOption) {
        preferences.theme = button.dataset.themeOption;
      } else {
        return;
      }

      try {
        localStorage.setItem(key, JSON.stringify(preferences));
      } catch {
        // Keep the controls usable when browser storage is unavailable.
      }
      applyPreferences();
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    customElements.define('reading-controls', ReadingControls);
  }, { once: true });
})();
