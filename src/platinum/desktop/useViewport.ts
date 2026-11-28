import { useEffect, useState } from 'react';
import { MENU_HEIGHT, STRIP_HEIGHT } from '../model';
import type { DesktopViewport } from '../types';

// Match the first browser render to the static HTML before measuring the viewport.
export const initialViewport: DesktopViewport = {
  width: 1440,
  height: 900,
  menuHeight: MENU_HEIGHT,
  stripHeight: STRIP_HEIGHT,
};

export const viewportSize = (): DesktopViewport => {
  const styles = getComputedStyle(document.documentElement);
  return {
    width: globalThis.innerWidth || 1024,
    height: globalThis.visualViewport?.height || globalThis.innerHeight || 768,
    menuHeight:
      Number.parseFloat(styles.getPropertyValue('--p9-menubar-height')) ||
      MENU_HEIGHT,
    stripHeight:
      Number.parseFloat(styles.getPropertyValue('--p9-control-strip-height')) ||
      STRIP_HEIGHT,
  };
};

export function useViewport() {
  const [viewport, setViewport] = useState(initialViewport);
  useEffect(() => {
    const resize = () => setViewport(viewportSize());
    const pointer = globalThis.matchMedia('(pointer: coarse)');
    resize();
    globalThis.addEventListener('resize', resize);
    pointer.addEventListener('change', resize);
    globalThis.visualViewport?.addEventListener('resize', resize);
    return () => {
      globalThis.removeEventListener('resize', resize);
      pointer.removeEventListener('change', resize);
      globalThis.visualViewport?.removeEventListener('resize', resize);
    };
  }, []);
  return viewport;
}
