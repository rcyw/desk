import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { postId } from './content-paths';

export type BlogPost = CollectionEntry<'posts'>;

const postsPerPage = 10;

export const siteName = 'Wayne’s Desk';
export const postHref = (entry: string) => `/posts/${postId(entry)}/`;
export const topicHref = (id: string) => `/topics/${id}/`;

export function paginatePosts(posts: BlogPost[], base: string) {
  const total = Math.max(1, Math.ceil(posts.length / postsPerPage));
  const maxRows = Math.min(posts.length, postsPerPage);
  const href = (page: number) => (page === 1 ? base : `${base}page/${page}/`);

  return Array.from({ length: total }, (_, index) => {
    const current = index + 1;
    return {
      path: href(current),
      posts: posts.slice(index * postsPerPage, current * postsPerPage),
      current,
      total,
      maxRows,
      newer: current > 1 ? href(current - 1) : undefined,
      older: current < total ? href(current + 1) : undefined,
    };
  });
}

export type PostPage = ReturnType<typeof paginatePosts>[number];

export async function readBlog() {
  const [posts, topics] = await Promise.all([
    getCollection('posts'),
    getCollection('topics'),
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
  topics.sort(
    (a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id),
  );

  const postsByTopic = new Map(
    topics.map((topic) => [topic.id, [] as BlogPost[]]),
  );
  for (const post of posts) {
    for (const topic of new Set(post.data.topics.map(({ id }) => id))) {
      const topicPosts = postsByTopic.get(topic);
      if (!topicPosts)
        throw new Error(`${post.id} references an unknown topic: ${topic}`);
      topicPosts.push(post);
    }
  }

  return {
    posts,
    topics: topics
      .map((topic) => ({ ...topic, posts: postsByTopic.get(topic.id) ?? [] }))
      .filter((topic) => topic.posts.length > 0),
  };
}

export type BlogTopic = Awaited<ReturnType<typeof readBlog>>['topics'][number];
