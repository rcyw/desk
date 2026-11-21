import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { briefId, postId } from './lib/content-paths';

function slug(id: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Use a lowercase, hyphenated slug for ${id}`);
  }
  return id;
}

const text = z.string().trim().min(1);
const markdownEntries = ['**/*.[mM][dD]', '!**/assets/**'];

const publication = z
  .object({
    title: text,
    description: text,
    lang: z.enum(['zh-CN', 'en']),
    publishedAt: z.iso.date(),
    updatedAt: z.iso.date().optional(),
    draft: z.boolean().default(false),
    sources: z
      .array(
        z.object({
          label: text,
          url: z.url({ protocol: /^https?$/ }).optional(),
          revision: text.optional(),
        }),
      )
      .optional(),
  })
  .refine((entry) => !entry.updatedAt || entry.updatedAt >= entry.publishedAt, {
    path: ['updatedAt'],
    message: 'updatedAt must be on or after publishedAt',
  });

const topics = defineCollection({
  loader: glob({
    base: './content/topics',
    pattern: '*.md',
    generateId: ({ entry }) => slug(entry.slice(0, -'.md'.length)),
  }),
  schema: z.object({
    title: text,
    description: text,
    lang: z.enum(['zh-CN', 'en']).default('en'),
    order: z.number().int().nonnegative(),
  }),
});

const posts = defineCollection({
  loader: glob({
    base: './content/posts',
    pattern: markdownEntries,
    generateId: ({ entry }) => {
      postId(entry);
      return entry;
    },
  }),
  schema: publication.safeExtend({
    kind: z.enum(['article', 'note']),
    topics: z.array(reference('topics')).min(1),
  }),
});

const briefs = defineCollection({
  loader: glob({
    base: './content/briefs',
    pattern: markdownEntries,
    generateId: ({ entry }) => briefId(entry),
  }),
  schema: publication.safeExtend({ highlights: z.array(text).optional() }),
});

export const collections = { posts, topics, briefs };
