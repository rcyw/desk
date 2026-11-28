import { navigate } from 'astro:transitions/client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { MouseEvent } from 'react';
import { deskAppIds, deskApps, siteName } from '../lib/desk-apps';
import type { DeskApp } from '../lib/desk-apps';
import { topicIndexes } from '../lib/topics';
import { Desktop } from '../platinum';
import type {
  AppDefinition,
  AppWindowProps,
  DesktopAPI,
  DesktopViewport,
} from '../platinum';
import { PaperBird } from './PaperBird';

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

const PagesContext = createContext<DeskPageState | null>(null);
const controlStripKey = 'desk:control-strip-expanded';
const controlStripApps = [
  'brief',
  'papers',
] as const satisfies readonly DeskApp[];

function windowBounds(
  viewport: DesktopViewport,
  heightHint: number,
  app: DeskApp,
) {
  const { width: limitWidth, xShift, cascade } = deskApps[app];
  const wide = viewport.width >= 1100;
  const horizontalRoom = wide ? 176 : 132;
  const width = Math.min(
    limitWidth,
    Math.max(1, viewport.width - horizontalRoom),
  );
  const menu = viewport.menuHeight ?? 20;
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
    x: Math.round((viewport.width - width) / 2 - xShift),
    y: menu + offset + cascade,
    width,
    height,
  };
}

function PageWindow({
  window: { appId, shaded },
  desktop: { activeWindowId },
}: AppWindowProps) {
  const app = appId as DeskApp;
  const { pages, currentPage, activatePage } = useContext(PagesContext)!;
  const page = pages[app];
  const position = useRef({ path: '', top: 0 });

  useLayoutEffect(() => {
    if (!page) return;
    const content = document.getElementById(page.mainId);
    if (!content) return;
    if (position.current.path !== page.path) {
      position.current = { path: page.path, top: content.scrollTop };
    }
    const remember = () => {
      if (content.clientHeight) position.current.top = content.scrollTop;
    };
    const restore = () => {
      if (content.clientHeight) content.scrollTop = position.current.top;
    };
    // Raising a window or moving the persisted island can reset nested scroll containers.
    restore();
    content.addEventListener('scroll', remember);
    document.addEventListener('astro:before-swap', remember);
    document.addEventListener('astro:after-swap', restore);
    return () => {
      content.removeEventListener('scroll', remember);
      document.removeEventListener('astro:before-swap', remember);
      document.removeEventListener('astro:after-swap', restore);
    };
  }, [page, activeWindowId, shaded]);

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

export function Desk({ page }: { page: DeskPage }) {
  const [cachedPages, setCachedPages] = useState<DeskPages>({
    [page.app]: page,
  });
  const [stripExpanded, setStripExpanded] = useState(true);
  const [showPaperBird, setShowPaperBird] = useState(false);
  const pages = { ...cachedPages, [page.app]: page };
  const previousPage = useRef(page);
  const desktop = useRef<DesktopAPI | null>(null);
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    try {
      setStripExpanded(localStorage.getItem(controlStripKey) !== 'false');
    } catch {
      // Keep the default when browser storage is unavailable.
    }
  }, []);

  function updateControlStrip(expanded: boolean) {
    setStripExpanded(expanded);
    try {
      localStorage.setItem(controlStripKey, String(expanded));
    } catch {
      // Keep the in-memory preference usable without storage.
    }
  }

  function showAbout() {
    void desktop.current?.dialog({
      title: siteName,
      icon: <img src="/favicon.svg" alt="" width={32} height={32} />,
      message: (
        <>
          Personal writing and project notes.
          <br />
          <a href="https://github.com/rcyw" rel="me">
            @rcyw on GitHub
          </a>
        </>
      ),
      buttons: [{ label: 'OK', value: 'ok', default: true }],
    });
  }

  const activatePage = useCallback((target: DeskPage) => {
    pendingFocus.current = target.mainId;
    desktop.current?.openApp(target.app);
  }, []);

  const launchApplication = useCallback(
    (app: DeskApp) => {
      if (page.app === app) activatePage(page);
      else void navigate(cachedPages[app]?.path ?? deskApps[app].entryPath);
    },
    [activatePage, cachedPages, page],
  );

  const openApplication = useCallback(
    (app: DeskApp) => {
      const { entryPath } = deskApps[app];
      if (page.app === app && page.path === entryPath) activatePage(page);
      else void navigate(entryPath);
    },
    [activatePage, page],
  );

  const onDesktopReady = useCallback((api: DesktopAPI) => {
    const previous = desktop.current;
    desktop.current = api;
    const hasWindows = api.windows.length > 0;
    if (previous && previous.windows.length > 0 !== hasWindows) {
      setShowPaperBird(!hasWindows);
    }

    const active = api.windows.find(
      (window) => window.id === api.activeWindowId,
    );
    const main =
      active && !active.shaded
        ? document.getElementById(deskApps[active.appId as DeskApp].mainId)
        : null;
    const skipLink = document.querySelector<HTMLAnchorElement>('.skip-link');
    if (skipLink) {
      skipLink.hidden = !main;
      if (main) skipLink.setAttribute('href', `#${main.id}`);
    }
    if (main && pendingFocus.current === main.id) {
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

  const apps = useMemo<AppDefinition[]>(() => {
    const destinations = {
      blog: [
        { label: 'Home', action: () => openApplication('blog') },
        { label: 'Topics', action: () => navigate(topicIndexes.blog) },
      ],
      brief: [
        { label: 'Latest', action: () => openApplication('brief') },
        { label: 'Archive', action: () => navigate('/brief/archive/') },
      ],
      papers: [{ label: 'Library', action: () => openApplication('papers') }],
      prompts: [{ label: 'Library', action: () => openApplication('prompts') }],
      github: [
        { label: 'Projects', action: () => openApplication('github') },
        { label: 'Topics', action: () => navigate(topicIndexes.github) },
      ],
    };
    return deskAppIds.map((app) => ({
      id: app,
      title: deskApps[app].label,
      icon: deskApps[app].icon,
      onLaunch: () => launchApplication(app),
      minSize: { width: 360, height: 280 },
      defaultBounds: (viewport) =>
        windowBounds(
          viewport,
          cachedPages[app]?.height ?? deskApps[app].height,
          app,
        ),
      component: PageWindow,
      menu: () => [
        {
          id: 'go',
          label: 'Go',
          items: [
            ...destinations[app],
            ...deskAppIds
              .filter((id) => id !== app)
              .map((id) => ({
                label: deskApps[id].label,
                action: () => openApplication(id),
              })),
          ],
        },
      ],
    }));
  }, [cachedPages, launchApplication, openApplication]);

  return (
    <PagesContext.Provider value={{ pages, currentPage: page, activatePage }}>
      <Desktop
        apps={apps}
        icons={deskAppIds.map((app) => ({
          id: app,
          label: deskApps[app].label,
          icon: deskApps[app].icon,
          appId: app,
          onOpen: () => launchApplication(app),
        }))}
        systemMenuIcon={
          <img src="/favicon.svg" alt="" width={16} height={16} />
        }
        desktopDecoration={
          showPaperBird && (
            <PaperBird onFinish={() => setShowPaperBird(false)} />
          )
        }
        initialWindows={[{ appId: page.app }]}
        wallpaper="lavender"
        controlStrip={stripExpanded}
        controlStripApps={controlStripApps}
        onControlStripChange={updateControlStrip}
        onAbout={showAbout}
        onReady={onDesktopReady}
      />
    </PagesContext.Provider>
  );
}
