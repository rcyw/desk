/* global document, innerWidth */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { preview } from 'astro';
import { chromium, devices, webkit } from 'playwright';

for (const [name, browser, options] of [
  ['desktop Chromium', chromium, { viewport: { width: 1280, height: 800 } }],
  ['Android Chromium', chromium, devices['Pixel 7']],
  ['iPhone WebKit', webkit, devices['iPhone 13']],
]) {
  test(`first Desk visit supports a cold offline launch on ${name}`, async (t) => {
    const profile = await mkdtemp(join(tmpdir(), 'desk-offline-'));

    const server = await preview({
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0 },
    });
    let serving = true;

    const root = `http://127.0.0.1:${server.port}/desk/`;
    let context;
    t.after(async () => {
      await context?.close();
      if (serving) await server.stop();
      await rm(profile, { recursive: true, force: true });
    });
    context = await browser.launchPersistentContext(profile, options);
    const first = await context.newPage();
    await first.goto(root);
    await first.getByRole('main', { name: 'Blog' }).waitFor();
    assert.equal(first.url(), root);
    await first.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    );
    const start = await first.evaluate(async () => {
      const response = await fetch(
        document.querySelector('link[rel="manifest"]').href,
      );
      return new URL((await response.json()).start_url, response.url).href;
    });
    await context.close();
    await server.stop();
    serving = false;

    context = await browser.launchPersistentContext(profile, options);
    const reopened = await context.newPage();
    const errors = [];
    reopened.on('pageerror', (error) => errors.push(error.message));
    reopened.on('requestfailed', (request) => {
      if (request.url().startsWith(root + '_astro/'))
        errors.push(request.url());
    });
    const launch = await reopened.goto(start);
    assert.equal(launch.status(), 200);
    await reopened.locator('.p9-desktop[data-viewport-ready="true"]').waitFor();
    assert.ok(await reopened.getByRole('main', { name: 'Blog' }).isVisible());
    assert.equal(
      await reopened.locator('html').getAttribute('data-reading-theme'),
      'light',
    );
    await reopened
      .getByRole('button', { name: 'Dark', exact: true })
      .first()
      .click();
    assert.equal(
      await reopened.locator('html').getAttribute('data-reading-theme'),
      'dark',
    );
    assert.ok(
      await reopened.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok(
      await reopened.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].some((font) => font.status === 'loaded');
      }),
    );
    assert.equal(reopened.url(), root);
    const missing = await reopened.goto(root + 'papers/');
    assert.equal(missing.status(), 503);
    assert.equal(await reopened.locator('h1').innerText(), 'Offline');
    assert.deepEqual(errors, []);
  });
}
