import {
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmdirSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { postId } from '../src/lib/content-paths.ts';

const repo = resolve(import.meta.dirname, '..');
const content = join(repo, 'content');
const posts = join(content, 'posts');
const display = (path) => relative(repo, path);
const stat = (path) => lstatSync(path, { throwIfNoEntry: false });

function directory(path) {
  const status = stat(path);
  if (status && !status.isDirectory()) {
    throw new Error(`Expected a real directory at ${display(path)}.`);
  }
  return Boolean(status);
}

function assertUnused(path) {
  if (stat(path))
    throw new Error(`Destination already exists at ${display(path)}.`);
}

function checkAssetTree(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) checkAssetTree(child);
    else if (!entry.isFile())
      throw new Error(`Expected a regular asset at ${display(child)}.`);
  }
}

function findPost(slug) {
  const filename = `${slug}.md`;
  const candidates = [join(posts, filename)];
  for (const entry of readdirSync(posts, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      postId(`${entry.name}/${filename}`);
    } catch {
      continue;
    }
    candidates.push(join(posts, entry.name, filename));
  }
  const matches = candidates.filter((path) => {
    const status = stat(path);
    if (status && !status.isFile()) {
      throw new Error(`Expected a regular post at ${display(path)}.`);
    }
    return Boolean(status);
  });
  if (!matches.length) throw new Error(`Post ${slug} was not found.`);
  if (matches.length > 1) {
    throw new Error(
      `Found more than one post with the slug ${slug}: ${matches.map(display).join(', ')}.`,
    );
  }
  return matches[0];
}

function ensureDirectory(path) {
  if (directory(path)) return;
  try {
    mkdirSync(path);
  } catch (error) {
    if (error.code !== 'EEXIST' || !directory(path)) throw error;
  }
}

function applyMove(source, destination, assets, targetAssets) {
  ensureDirectory(dirname(destination));
  if (assets) ensureDirectory(dirname(targetAssets));
  const options = { bigint: true, throwIfNoEntry: false };
  const original = lstatSync(source, options);
  if (!original?.isFile()) {
    throw new Error(`Expected a regular post at ${display(source)}.`);
  }
  copyFileSync(source, destination, constants.COPYFILE_EXCL);
  let movedAssets = false;
  try {
    if (assets) {
      assertUnused(targetAssets);
      renameSync(assets, targetAssets);
      movedAssets = true;
    }
    const current = lstatSync(source, options);
    if (
      !current?.isFile() ||
      current.dev !== original.dev ||
      current.ino !== original.ino ||
      current.size !== original.size ||
      current.mtimeNs !== original.mtimeNs ||
      current.ctimeNs !== original.ctimeNs
    ) {
      throw new Error(
        `Post ${display(source)} changed during the move. Check it and retry.`,
      );
    }
    unlinkSync(source);
  } catch (error) {
    if (movedAssets) {
      try {
        assertUnused(assets);
        renameSync(targetAssets, assets);
      } catch (failure) {
        throw new Error(
          `${error.message} Could not restore the assets (${failure.message}). The copy at ${display(destination)} and its assets were kept.`,
          { cause: failure },
        );
      }
    }
    try {
      unlinkSync(destination);
    } catch (failure) {
      throw new Error(
        `${error.message} Could not remove the copy at ${display(destination)} (${failure.message}).`,
        { cause: failure },
      );
    }
    throw error;
  }
}

function regroup(slug, category, apply) {
  const target = join(posts, category);
  const targetExists = directory(target);
  const source = findPost(slug);
  const destination = join(target, `${slug}.md`);
  if (source === destination) {
    console.log(`${slug} is already in ${category}.`);
    return;
  }

  const assetRoot = join(dirname(source), 'assets');
  const sourceAssets = join(assetRoot, slug);
  const hasAssets = directory(assetRoot) && directory(sourceAssets);
  if (hasAssets) checkAssetTree(sourceAssets);
  const targetAssetRoot = join(target, 'assets');
  const targetAssets = join(targetAssetRoot, slug);
  if (targetExists) {
    assertUnused(destination);
    if (directory(targetAssetRoot)) assertUnused(targetAssets);
  }

  console.log(`${display(source)} → ${display(destination)}`);
  if (hasAssets)
    console.log(`${display(sourceAssets)} → ${display(targetAssets)}`);
  if (apply)
    applyMove(
      source,
      destination,
      hasAssets ? sourceAssets : null,
      targetAssets,
    );
  else console.log('Dry run. Add --apply to move the post.');
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { apply: { type: 'boolean' } },
  });
  if (positionals.length !== 2) {
    throw new Error('Usage: pnpm content:move <slug> <category> [--apply]');
  }
  const [slug, category] = positionals;
  postId(`${category}/${slug}.md`);
  if (!directory(content) || !directory(posts))
    throw new Error('Missing content/posts directory.');
  if (!values.apply) return regroup(slug, category, false);

  process.once('SIGINT', () => {
    process.exitCode ??= 130;
  });
  process.once('SIGTERM', () => {
    process.exitCode ??= 143;
  });
  const lock = join(posts, `.move-post-${slug}`);
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(
      `A move lock exists at ${display(lock)}. Wait until the previous process has exited, then check the source, destination, and assets before removing the empty lock directory and retrying.`,
      { cause: error },
    );
  }
  try {
    regroup(slug, category, true);
  } finally {
    rmdirSync(lock);
    // Process pending termination signals after the synchronous move and cleanup.
    await setImmediate();
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
