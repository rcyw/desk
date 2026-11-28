import react from '@astrojs/react';
import { defineConfig } from 'astro/config';
import { offlineShell } from './scripts/build-offline-shell.mjs';

const notoFontDisplay = {
  postcssPlugin: 'noto-font-display',
  AtRule: {
    'font-face'(rule) {
      const isNoto = rule.nodes?.some(
        (node) =>
          node.type === 'decl' &&
          node.prop === 'font-family' &&
          node.value.replace(/['"]/g, '') === 'Noto Sans SC Variable',
      );
      if (!isNoto) return;
      // Keep the Fontsource subsets while avoiding a visible fallback on quick loads.
      rule.walkDecls('font-display', (declaration) => {
        if (declaration.value === 'swap') declaration.value = 'block';
      });
    },
  },
};

export default defineConfig({
  site: 'https://rcyw.github.io',
  base: '/desk',
  output: 'static',
  trailingSlash: 'always',
  integrations: [react(), offlineShell()],
  devToolbar: { enabled: false },
  vite: { css: { postcss: { plugins: [notoFontDisplay] } } },
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
