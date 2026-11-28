import { sitePath } from './site-path';
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type Paper = CollectionEntry<'papers'>;

export const paperHref = (id: string) => sitePath(`/papers/${id}/`);

export async function readPapers(): Promise<{
  papers: Paper[];
  topics: CollectionEntry<'topics'>[];
}> {
  const [papers, topics] = await Promise.all([
    getCollection('papers'),
    getCollection('topics'),
  ]);
  const topicIds = new Set(topics.map(({ id }) => id));
  const usedTopics = new Set<string>();

  for (const paper of papers) {
    for (const { id } of paper.data.topics) {
      if (!topicIds.has(id)) {
        throw new Error(`${paper.id} references an unknown topic: ${id}`);
      }
      usedTopics.add(id);
    }
  }

  papers.sort(
    (a, b) =>
      b.data.publishedAt.localeCompare(a.data.publishedAt) ||
      a.id.localeCompare(b.id),
  );
  topics.sort(
    (a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id),
  );

  return { papers, topics: topics.filter(({ id }) => usedTopics.has(id)) };
}
