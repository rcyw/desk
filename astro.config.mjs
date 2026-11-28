import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

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
  output: 'static',
  trailingSlash: 'always',
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: { css: { postcss: { plugins: [notoFontDisplay] } } },
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
