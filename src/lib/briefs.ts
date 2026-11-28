import { sitePath } from './site-path';
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type Brief = CollectionEntry<'briefs'>;

export const briefName = 'AI Brief';
export const briefHref = (id: string) => sitePath(`/brief/${id}/`);

export async function readBriefs(): Promise<Brief[]> {
  const briefs = await getCollection('briefs');
  return briefs.sort((a, b) => b.id.localeCompare(a.id));
}
