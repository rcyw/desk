const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function postId(entry: string): string {
  const parts = entry.split('/');
  const filename = parts.at(-1) ?? '';
  const id = filename.slice(0, -3);
  const category = parts[0];
  if (
    !filename.endsWith('.md') ||
    !slugPattern.test(id) ||
    id === 'index' ||
    parts.length > 2 ||
    (parts.length === 2 &&
      (category === 'assets' || !slugPattern.test(category)))
  ) {
    throw new Error(
      `Expected a Blog post at <slug>.md or <category>/<slug>.md. Found ${entry}`,
    );
  }
  return id;
}

export function libraryId(
  entry: string,
  collection: 'papers' | 'prompts',
): string {
  const id = entry.slice(0, -3);
  if (!entry.endsWith('.md') || !slugPattern.test(id) || id === 'index') {
    const label = collection === 'papers' ? 'paper note' : 'prompt collection';
    throw new Error(
      `Expected a ${label} at <slug>.md with a lowercase, hyphenated name. Found ${entry}`,
    );
  }
  return id;
}

export function briefId(entry: string): string {
  const [, year, month, date] =
    /^(\d{4})\/(\d{2})\/(\d{4}-\d{2}-\d{2})\.md$/.exec(entry) ?? [];
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (
    !date ||
    !date.startsWith(`${year}-${month}-`) ||
    Number.isNaN(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(
      `Expected an AI Brief at YYYY/MM/YYYY-MM-DD.md with a matching calendar date. Found ${entry}`,
    );
  }
  return date;
}
