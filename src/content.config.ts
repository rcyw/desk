import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { briefId, libraryId, postId, topicId } from './lib/content-paths';

const text = z.string().trim().min(1);
const webUrl = z.url({ protocol: /^https?$/ });
const source = z.object({
  label: text,
  url: webUrl.optional(),
  revision: text.optional(),
});
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
    sources: z.array(source).optional(),
  })
  .refine((entry) => !entry.updatedAt || entry.updatedAt >= entry.publishedAt, {
    path: ['updatedAt'],
    message: 'updatedAt must be on or after publishedAt',
  });

function defineTopics(base: string) {
  return defineCollection({
    loader: glob({
      base,
      pattern: markdownEntries,
      generateId: ({ entry }) => topicId(entry),
    }),
    schema: z.object({
      title: text,
      description: text,
      lang: z.enum(['zh-CN', 'en']).default('en'),
      order: z.number().int().nonnegative(),
    }),
  });
}

const topics = defineTopics('./content/topics');
const githubTopics = defineTopics('./content/github/topics');

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

const github = defineCollection({
  loader: glob({
    base: './content/github',
    pattern: [...markdownEntries, '!topics/**'],
    generateId: ({ entry }) => libraryId(entry, 'github'),
  }),
  schema: publication.safeExtend({
    topics: z.array(reference('githubTopics')).min(1),
    sources: z
      .array(source)
      .refine(
        (sources) => sources.some(({ url, revision }) => url && revision),
        'Include a repository URL and its revision together in sources.',
      ),
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

export const collections = {
  posts,
  github,
  githubTopics,
  topics,
  briefs,
  papers,
  prompts,
};
