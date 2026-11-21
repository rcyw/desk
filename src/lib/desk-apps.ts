import type { IconName } from '../platinum/types';

export const papersName = 'Papers';
export const deskAppIds = ['blog', 'brief', 'papers'] as const;
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
    entryPath: '/',
    mainId: 'main-content',
    icon: 'notes',
    width: 1064,
    height: 340,
    xShift: 18,
    cascade: 0,
  },
  brief: {
    label: 'AI Brief',
    entryPath: '/brief/',
    mainId: 'brief-content',
    icon: 'newspaper',
    width: 912,
    height: 380,
    xShift: 6,
    cascade: 22,
  },
  papers: {
    label: papersName,
    entryPath: '/papers/',
    mainId: 'papers-content',
    icon: 'papers',
    width: 912,
    height: 460,
    xShift: -6,
    cascade: 44,
  },
} as const satisfies Record<DeskApp, DeskAppConfig>;
