import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Pin the launcher and its dependencies together so a new deployment can
// finish installing before the active worker releases the previous shell.
export function offlineShell() {
  const imports = new Map();
  let publicRoot;
  return {
    name: 'desk-offline-shell',
    hooks: {
      'astro:config:setup'({ config, updateConfig }) {
        publicRoot = new URL(config.base.replace(/\/?$/, '/'), config.site);
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'desk-launch-imports',
                applyToEnvironment: (environment) =>
                  environment.name === 'client',
                generateBundle(_, bundle) {
                  for (const item of Object.values(bundle)) {
                    if (item.type === 'chunk')
                      imports.set(item.fileName, [
                        ...item.imports,
                        ...item.dynamicImports,
                        ...item.viteMetadata.importedAssets,
                        ...item.viteMetadata.importedCss,
                      ]);
                  }
                },
              },
            ],
          },
        });
      },
      async 'astro:build:done'({ dir }) {
        const paths = new Set([
          './',
          'blog/',
          'offline.html',
          'manifest.webmanifest',
          'favicon.svg',
        ]);
        const manifest = JSON.parse(
          await readFile(new URL('manifest.webmanifest', dir)),
        );
        for (const icon of manifest.icons)
          paths.add(icon.src.replace(/^\.\//, ''));
        paths.add('icons/desk-180.png');

        const home = await readFile(new URL('blog/index.html', dir), 'utf8');
        const homeUrl = new URL('blog/', publicRoot);
        const assetRoot = new URL('_astro/', publicRoot);
        for (const match of home.matchAll(
          /(?:src|href|component-url|renderer-url)="([^"]+)"/g,
        )) {
          const url = new URL(match[1], homeUrl);
          if (url.href.startsWith(assetRoot.href))
            paths.add(url.pathname.slice(publicRoot.pathname.length));
        }

        const digest = createHash('sha256');
        for (const path of paths) {
          const file = new URL(
            path.endsWith('/') ? path + 'index.html' : path,
            dir,
          );
          const bytes = await readFile(file);
          digest.update(path).update(bytes);
          if (path.endsWith('.js') && !imports.has(path))
            throw new Error(`Missing build dependencies for ${path}`);
          for (const dependency of imports.get(path) ?? [])
            paths.add(dependency);
          if (path.endsWith('.css')) {
            for (const match of bytes
              .toString()
              .matchAll(/url\(["']?([^)'"]+)["']?\)/g)) {
              const asset = new URL(match[1], new URL(path, publicRoot));
              if (asset.href.startsWith(publicRoot.href))
                paths.add(asset.href.slice(publicRoot.href.length));
            }
          }
        }

        const worker = await readFile(
          new URL('../src/pwa/desk-sw.js', import.meta.url),
          'utf8',
        );
        const shell = {
          revision: digest.digest('hex').slice(0, 16),
          paths: [...paths],
        };
        await writeFile(
          new URL('desk-sw.js', dir),
          `const deskShell = ${JSON.stringify(shell)};\n${worker}`,
        );
      },
    },
  };
}
