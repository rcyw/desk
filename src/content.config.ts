import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

function slug(id: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Use a lowercase, hyphenated slug for ${id}`);
  }
  return id;
}

const text = z.string().trim().min(1);

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
    pattern: '*/index.md',
    generateId: ({ entry }) => slug(entry.slice(0, -'/index.md'.length)),
  }),
  schema: z
    .object({
      title: text,
      description: text,
      kind: z.enum(['article', 'note']),
      lang: z.enum(['zh-CN', 'en']),
      publishedAt: z.iso.date(),
      updatedAt: z.iso.date().optional(),
      topics: z.array(reference('topics')).min(1),
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
    .refine((post) => !post.updatedAt || post.updatedAt >= post.publishedAt, {
      path: ['updatedAt'],
      message: 'updatedAt must be on or after publishedAt',
    }),
});

export const collections = { posts, topics };
