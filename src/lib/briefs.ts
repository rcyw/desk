import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type Brief = CollectionEntry<'briefs'>;

export const briefName = 'AI Brief';
export const briefHref = (id: string) => `/brief/${id}/`;

export async function readBriefs(): Promise<Brief[]> {
  const briefs = await getCollection('briefs', ({ data }) => !data.draft);
  return briefs.sort((a, b) => b.id.localeCompare(a.id));
}
