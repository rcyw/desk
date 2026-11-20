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
    pattern: '*/index.md',
    generateId: ({ entry }) => slug(entry.slice(0, -'/index.md'.length)),
  }),
  schema: publication.safeExtend({
    kind: z.enum(['article', 'note']),
    topics: z.array(reference('topics')).min(1),
  }),
});

const briefs = defineCollection({
  loader: glob({
    base: './content/briefs',
    pattern: '**/*.md',
    generateId: ({ entry }) => {
      const date = entry
        .match(/^(\d{4})\/(\d{2})\/(\d{2})\/index\.md$/)
        ?.slice(1)
        .join('-');
      const parsed = z.iso.date().safeParse(date);
      if (!parsed.success) {
        throw new Error(
          `Expected an AI Brief at YYYY/MM/DD/index.md with a valid date. Found ${entry}`,
        );
      }
      return parsed.data;
    },
  }),
  schema: publication.safeExtend({ highlights: z.array(text).optional() }),
});

export const collections = { posts, topics, briefs };
