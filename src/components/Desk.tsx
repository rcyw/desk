import { navigate } from 'astro:transitions/client';
import { useEffect, useMemo, useRef } from 'react';
import { Desktop } from '../platinum';
import type { AppDefinition, DesktopIcon, DesktopViewport } from '../platinum';

const icons: DesktopIcon[] = [
  { id: 'blog', label: 'Blog', icon: 'notes', appId: 'blog' },
];
const initialWindows = [{ appId: 'blog' }];

function blogBounds(viewport: DesktopViewport, blogHeight: number) {
  const wide = viewport.width >= 1100;
  const horizontalRoom = wide ? 176 : 132;
  const width = Math.min(1064, Math.max(1, viewport.width - horizontalRoom));
  const menu = viewport.menuHeight ?? 20;
  const availableHeight = Math.max(1, viewport.height - menu - (viewport.stripHeight ?? 24) - 32);
  const height = Math.min(blogHeight, availableHeight);
  const offset = Math.max(8, Math.min(84, Math.round((availableHeight - height) / 2)));
  return {
    x: Math.round((viewport.width - width) / 2 - 18),
    y: menu + offset,
    width,
    height,
  };
}

export function Desk({
  blogTitle,
  blogHeight,
  blogHtml,
}: {
  blogTitle: string;
  blogHeight: number;
  blogHtml: string;
}) {
  const previousHtml = useRef(blogHtml);
  useEffect(() => {
    if (previousHtml.current === blogHtml) return;
    previousHtml.current = blogHtml;
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [blogHtml]);

  const apps = useMemo<AppDefinition[]>(() => {
    function BlogWindow() {
      // The reading controls may already have upgraded this Astro markup.
      return (
        <div
          className="blog-slot"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: blogHtml }}
        />
      );
    }

    return [
      {
        id: 'blog',
        title: blogTitle,
        icon: 'notes',
        minSize: { width: 360, height: 280 },
        defaultBounds: (viewport) => blogBounds(viewport, blogHeight),
        component: BlogWindow,
        menu: () => [
          {
            id: 'go',
            label: 'Go',
            items: [
              { label: 'Home', action: () => navigate('/') },
              { label: 'Topics', action: () => navigate('/topics/') },
            ],
          },
        ],
      },
    ];
  }, [blogTitle, blogHeight, blogHtml]);

  return (
    <Desktop
      apps={apps}
      icons={icons}
      systemMenuIcon={<img src="/favicon.svg" alt="" width={16} height={16} />}
      initialWindows={initialWindows}
      wallpaper="lavender"
      controlStrip={false}
    />
  );
}
