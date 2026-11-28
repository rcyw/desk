import { sitePath } from './site-path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { groupTopics } from './topics';

export type Project = CollectionEntry<'github'>;
export const projectHref = (id: string) => sitePath(`/github/${id}/`);

export async function readGitHub() {
  const [projects, topics] = await Promise.all([
    getCollection('github'),
    getCollection('githubTopics'),
  ]);
  projects.sort(
    (a, b) =>
      b.data.publishedAt.localeCompare(a.data.publishedAt) ||
      a.id.localeCompare(b.id),
  );
  return { projects, topics: groupTopics(topics, projects) };
}
