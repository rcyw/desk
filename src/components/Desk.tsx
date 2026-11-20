import { navigate } from 'astro:transitions/client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { MouseEvent } from 'react';
import { Desktop } from '../platinum';
import type {
  AppDefinition,
  AppWindowProps,
  DesktopAPI,
  DesktopIcon,
  DesktopViewport,
} from '../platinum';

export type DeskApp = 'blog' | 'brief';

interface DeskPage {
  app: DeskApp;
  path: string;
  mainId: string;
  html: string;
  height: number;
}

type DeskPages = Partial<Record<DeskApp, DeskPage>>;

interface DeskPageState {
  pages: DeskPages;
  currentPage: DeskPage;
  activatePage: (page: DeskPage) => void;
}

const icons = [
  { id: 'blog', label: 'Blog', icon: 'notes', appId: 'blog' },
  { id: 'brief', label: 'AI Brief', icon: 'newspaper', appId: 'brief' },
] as const satisfies readonly DesktopIcon[];
const entryPaths = { blog: '/', brief: '/brief/' };
const PagesContext = createContext<DeskPageState | null>(null);

function windowBounds(
  viewport: DesktopViewport,
  heightHint: number,
  app: DeskApp,
) {
  const brief = app === 'brief';
  const wide = viewport.width >= 1100;
  const horizontalRoom = wide ? 176 : 132;
  const width = Math.min(
    brief ? 912 : 1064,
    Math.max(1, viewport.width - horizontalRoom),
  );
  const menu = viewport.menuHeight ?? 20;
  const cascade = brief ? 22 : 0;
  const availableHeight = Math.max(
    1,
    viewport.height - menu - (viewport.stripHeight ?? 24) - 32 - cascade,
  );
  const height = Math.min(heightHint, availableHeight);
  const offset = Math.max(
    8,
    Math.min(84, Math.round((availableHeight - height) / 2)),
  );
  return {
    x: Math.round((viewport.width - width) / 2 - (brief ? 6 : 18)),
    y: menu + offset + cascade,
    width,
    height,
  };
}

function PageWindow({ window: { appId } }: AppWindowProps) {
  const app = appId === 'brief' ? 'brief' : 'blog';
  const { pages, currentPage, activatePage } = useContext(PagesContext)!;
  const page = pages[app];

  function handleLink(event: MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !(event.target instanceof Element)
    )
      return;
    const link = event.target.closest<HTMLAnchorElement>('a[data-desk-app]');
    if (
      !link ||
      link.dataset.deskApp !== currentPage.app ||
      link.origin !== location.origin ||
      link.pathname !== currentPage.path
    )
      return;

    // The route already has this page, but its window can be behind or closed.
    if (link.href === location.href) event.preventDefault();
    activatePage(currentPage);
  }

  return page ? (
    // Reading controls may already have upgraded this server-rendered markup.
    <div
      className="blog-slot"
      suppressHydrationWarning
      onClick={handleLink}
      dangerouslySetInnerHTML={{ __html: page.html }}
    />
  ) : null;
}

export function Desk({
  blogTitle,
  briefTitle,
  page,
}: {
  blogTitle: string;
  briefTitle: string;
  page: DeskPage;
}) {
  const [cachedPages, setCachedPages] = useState<DeskPages>({
    [page.app]: page,
  });
  const pages = { ...cachedPages, [page.app]: page };
  const previousPage = useRef(page);
  const desktop = useRef<DesktopAPI | null>(null);
  const pendingFocus = useRef<string | null>(null);

  const activatePage = useCallback((target: DeskPage) => {
    pendingFocus.current = target.mainId;
    desktop.current?.openApp(target.app);
  }, []);

  const launchApplication = useCallback(
    (app: DeskApp) => {
      const target = page.app === app ? page : cachedPages[app];
      if (target) activatePage(target);
      else void navigate(entryPaths[app]);
    },
    [activatePage, cachedPages, page],
  );

  const openApplication = useCallback(
    (app: DeskApp) => {
      if (page.app === app && page.path === entryPaths[app]) activatePage(page);
      else void navigate(entryPaths[app]);
    },
    [activatePage, page],
  );

  const onDesktopReady = useCallback((api: DesktopAPI) => {
    desktop.current = api;
    const active = api.windows.find(
      (window) => window.id === api.activeWindowId,
    );
    const mainId = active?.appId === 'brief' ? 'brief-content' : 'main-content';
    const main = document.getElementById(mainId);
    if (main) {
      document.querySelector('.skip-link')?.setAttribute('href', `#${mainId}`);
    }
    if (pendingFocus.current === mainId && main) {
      main.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  }, []);

  useEffect(() => {
    const previous = previousPage.current;
    if (previous.path === page.path && previous.html === page.html) return;
    previousPage.current = page;
    setCachedPages((current) => ({ ...current, [page.app]: page }));
    activatePage(page);
  }, [activatePage, page]);

  const apps = useMemo<AppDefinition[]>(
    () => [
      {
        id: 'blog',
        title: blogTitle,
        icon: 'notes',
        onLaunch: () => launchApplication('blog'),
        minSize: { width: 360, height: 280 },
        defaultBounds: (viewport) =>
          windowBounds(viewport, cachedPages.blog?.height ?? 340, 'blog'),
        component: PageWindow,
        menu: () => [
          {
            id: 'go',
            label: 'Go',
            items: [
              { label: 'Home', action: () => navigate('/') },
              { label: 'Topics', action: () => navigate('/topics/') },
              { label: briefTitle, action: () => openApplication('brief') },
            ],
          },
        ],
      },
      {
        id: 'brief',
        title: briefTitle,
        icon: 'newspaper',
        onLaunch: () => launchApplication('brief'),
        minSize: { width: 360, height: 280 },
        defaultBounds: (viewport) =>
          windowBounds(viewport, cachedPages.brief?.height ?? 380, 'brief'),
        component: PageWindow,
        menu: () => [
          {
            id: 'go',
            label: 'Go',
            items: [
              { label: 'Latest', action: () => navigate('/brief/') },
              { label: 'Archive', action: () => navigate('/brief/archive/') },
              { label: 'Blog', action: () => openApplication('blog') },
            ],
          },
        ],
      },
    ],
    [blogTitle, briefTitle, cachedPages, launchApplication, openApplication],
  );

  return (
    <PagesContext.Provider value={{ pages, currentPage: page, activatePage }}>
      <Desktop
        apps={apps}
        icons={icons.map((icon) => ({
          ...icon,
          onOpen: () => launchApplication(icon.appId),
        }))}
        systemMenuIcon={
          <img src="/favicon.svg" alt="" width={16} height={16} />
        }
        initialWindows={[{ appId: page.app }]}
        wallpaper="lavender"
        controlStrip={false}
        onReady={onDesktopReady}
      />
    </PagesContext.Provider>
  );
}
