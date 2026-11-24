import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { briefId, libraryId, postId } from './lib/content-paths';

function slug(id: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Use a lowercase, hyphenated slug for ${id}`);
  }
  return id;
}

const text = z.string().trim().min(1);
const webUrl = z.url({ protocol: /^https?$/ });
const markdownEntries = ['**/*.[mM][dD]', '!**/assets/**'];
const topicReferences = z.array(reference('topics')).min(1);

const publication = z
  .object({
    title: text,
    description: text,
    lang: z.enum(['zh-CN', 'en']),
    publishedAt: z.iso.date(),
    updatedAt: z.iso.date().optional(),
    // Reject legacy draft flags before content can enter a build.
    draft: z
      .never({
        error:
          'Remove the draft field from publishable Markdown. Keep unfinished drafts outside the content collections.',
      })
      .optional(),
    sources: z
      .array(
        z.object({
          label: text,
          url: webUrl.optional(),
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
    topics: topicReferences,
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

const papers = defineCollection({
  loader: glob({
    base: './content/papers',
    pattern: markdownEntries,
    generateId: ({ entry }) => libraryId(entry, 'papers'),
  }),
  schema: publication.safeExtend({
    topics: topicReferences,
    paper: z.object({
      title: text,
      source: text,
      url: webUrl,
      version: text,
    }),
  }),
});

const prompts = defineCollection({
  loader: glob({
    base: './content/prompts',
    pattern: markdownEntries,
    generateId: ({ entry }) => libraryId(entry, 'prompts'),
  }),
  schema: publication,
});

export const collections = { posts, topics, briefs, papers, prompts };
