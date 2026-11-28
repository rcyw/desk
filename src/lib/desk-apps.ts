import { sitePath } from './site-path';
import type { IconName } from '../platinum/types';

export const siteName = 'Wayne’s Desk';
export const papersName = 'Papers';
export const promptsName = 'Prompts';
export const deskAppIds = [
  'blog',
  'brief',
  'papers',
  'prompts',
  'github',
] as const;
export type DeskApp = (typeof deskAppIds)[number];

interface DeskAppConfig {
  label: string;
  entryPath: string;
  mainId: string;
  icon: IconName;
  width: number;
  height: number;
  xShift: number;
  cascade: number;
}

export const deskApps = {
  blog: {
    label: 'Blog',
    entryPath: sitePath('/blog/'),
    mainId: 'main-content',
    icon: 'notes',
    width: 1064,
    height: 340,
    xShift: 18,
    cascade: 0,
  },
  brief: {
    label: 'AI Brief',
    entryPath: sitePath('/brief/'),
    mainId: 'brief-content',
    icon: 'newspaper',
    width: 912,
    height: 380,
    xShift: 6,
    cascade: 22,
  },
  papers: {
    label: papersName,
    entryPath: sitePath('/papers/'),
    mainId: 'papers-content',
    icon: 'papers',
    width: 912,
    height: 460,
    xShift: -6,
    cascade: 44,
  },
  prompts: {
    label: promptsName,
    entryPath: sitePath('/prompts/'),
    mainId: 'prompts-content',
    icon: 'prompts',
    width: 880,
    height: 300,
    xShift: 6,
    cascade: 66,
  },
  github: {
    label: 'GitHub',
    entryPath: sitePath('/github/'),
    mainId: 'github-content',
    icon: 'github',
    width: 960,
    height: 560,
    xShift: -18,
    cascade: 88,
  },
} as const satisfies Record<DeskApp, DeskAppConfig>;
