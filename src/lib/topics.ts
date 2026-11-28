import { sitePath } from './site-path';
import type { CollectionEntry } from 'astro:content';

export type Topic = CollectionEntry<'blogTopics' | 'githubTopics'>;
export const topicIndexes = {
  blog: sitePath('/topics/'),
  github: sitePath('/github/topics/'),
};

export function topicHref(topic: Topic) {
  const base =
    topic.collection === 'githubTopics'
      ? topicIndexes.github
      : topicIndexes.blog;
  return `${base}${topic.id}/`;
}

export function groupTopics<
  T extends Topic,
  E extends CollectionEntry<'posts' | 'github'>,
>(topics: T[], entries: E[]) {
  const groups = new Map(
    topics.map((topic) => [topic.id, { topic, entries: [] as E[] }]),
  );
  for (const entry of entries) {
    for (const id of new Set(
      entry.data.topics.map((reference) => reference.id),
    )) {
      const group = groups.get(id);
      if (!group)
        throw new Error(
          `${entry.collection}/${entry.id} references an unknown topic: ${id}`,
        );
      group.entries.push(entry);
    }
  }
  return [...groups.values()]
    .filter(({ entries }) => entries.length > 0)
    .sort(
      ({ topic: a }, { topic: b }) =>
        a.data.order - b.data.order || a.id.localeCompare(b.id),
    );
}
