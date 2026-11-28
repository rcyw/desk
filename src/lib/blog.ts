import { sitePath } from './site-path';
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { postId } from './content-paths';
import { groupTopics } from './topics';

export type BlogPost = CollectionEntry<'posts'>;

export const postHref = (entry: string) => sitePath(`/posts/${postId(entry)}/`);

export async function readBlog() {
  const [posts, topics] = await Promise.all([
    getCollection('posts'),
    getCollection('blogTopics'),
  ]);

  const filesBySlug = new Map<string, string>();
  for (const { id } of posts) {
    const slug = postId(id);
    const previousFile = filesBySlug.get(slug);
    if (previousFile) {
      throw new Error(
        `Duplicate Blog slug "${slug}" in ${previousFile} and ${id}`,
      );
    }
    filesBySlug.set(slug, id);
  }

  posts.sort(
    (a, b) =>
      b.data.publishedAt.localeCompare(a.data.publishedAt) ||
      postId(a.id).localeCompare(postId(b.id)),
  );
  return { posts, topics: groupTopics(topics, posts) };
}
