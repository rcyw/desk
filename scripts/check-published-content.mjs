import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import {
  briefId,
  libraryId,
  postId,
  topicId,
} from '../src/lib/content-paths.ts';

const base = process.argv[2];
if (!base) throw new Error('Pass the Git base revision to check.');

const changes = execFileSync(
  'git',
  [
    'diff',
    '--name-status',
    '--diff-filter=ACMR',
    '--find-renames',
    '-z',
    base,
    'HEAD',
    '--',
  ],
  { encoding: 'utf8' },
).split('\0');

function contentRoute(file, legacySource = false) {
  const [folder, collection, ...parts] = file.split('/');
  if (folder !== 'content' || parts.includes('assets') || !/\.md$/i.test(file))
    return;

  if (
    collection === 'topics' ||
    (collection === 'github' && parts[0] === 'topics')
  ) {
    topicId((collection === 'topics' ? parts : parts.slice(1)).join('/'));
    // A valid topic only gets a page once an entry uses it.
    return;
  }

  let entry = parts.join('/');
  if (
    collection === 'papers' ||
    collection === 'prompts' ||
    collection === 'github'
  )
    return `${collection}/${libraryId(entry, collection)}`;
  if (collection === 'posts') {
    if (legacySource && parts.length === 2 && parts[1] === 'index.md')
      entry = `${parts[0]}.md`;
    return `posts/${postId(entry)}`;
  }
  if (collection !== 'briefs') return;

  if (legacySource && parts.length === 4 && parts[3] === 'index.md') {
    const [year, month, day] = parts;
    entry = `${year}/${month}/${year}-${month}-${day}.md`;
  }
  return `brief/${briefId(entry)}`;
}

function checkPage(file, route, message) {
  const page = statSync(`dist/${route}/index.html`, { throwIfNoEntry: false });
  if (!page?.isFile() || page.size === 0) {
    console.error(`::error file=${file}::${message}`);
    process.exitCode = 1;
  }
}

// Git's NUL-delimited name-status records have two paths for detected renames
// and copies. Read both sides across the full diff to catch moves out of content.
// Deliberate deletions appear as D records and remain outside this gate.
for (let index = 0; index < changes.length - 1;) {
  const kind = changes[index++][0];
  const source = kind === 'R' || kind === 'C' ? changes[index++] : undefined;
  const file = changes[index++];
  const route = contentRoute(file);
  if (route) {
    checkPage(
      file,
      route,
      'This entry has no published page. Check its filename and route.',
    );
  }
  if (kind === 'R') {
    let oldRoute;
    try {
      oldRoute = contentRoute(source, true);
    } catch {
      // A case or path correction can make a previously invalid entry public.
    }
    if (oldRoute && oldRoute !== route) {
      checkPage(file, oldRoute, `Renamed entries must preserve /${oldRoute}/.`);
    }
  }
}
