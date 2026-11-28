const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function topicId(entry: string): string {
  const id = entry.slice(0, -3);
  if (!entry.endsWith('.md') || !slugPattern.test(id)) {
    throw new Error(
      `Expected a topic at <slug>.md with a lowercase, hyphenated name. Found ${entry}`,
    );
  }
  return id;
}

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
      (category === 'assets' ||
        category === 'topics' ||
        !slugPattern.test(category)))
  ) {
    throw new Error(
      `Expected a Blog post at <slug>.md or <category>/<slug>.md. Found ${entry}`,
    );
  }
  return id;
}

export function libraryId(
  entry: string,
  collection: 'papers' | 'prompts' | 'github',
): string {
  const id = entry.slice(0, -3);
  if (collection === 'github' && id === 'topics') {
    throw new Error('GitHub reserves the slug "topics" for its topic index.');
  }
  if (!entry.endsWith('.md') || !slugPattern.test(id) || id === 'index') {
    const label = {
      papers: 'paper note',
      prompts: 'prompt collection',
      github: 'GitHub project reference',
    }[collection];
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
