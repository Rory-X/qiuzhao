import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';

const isPortfolioPath = (path: string) => /^\/projects(?:\/|$)/.test(path);
const routeKey = () => window.location.pathname + window.location.search + window.location.hash;

/** Native links keep open-in-new-tab behavior; ordinary portfolio clicks stay in React. */
export function usePortfolioNavigation() {
  const [route, setRoute] = useState(routeKey);
  const mainRef = useRef<HTMLElement>(null);
  const currentEntry = useRef('');
  const positions = useRef(new Map<string, number>());
  const transition = useRef<{ skipTransition(): void } | null>(null);
  const animation = useRef<Animation | null>(null);

  const showRoute = useCallback((restoreY?: number) => {
    const update = () => {
      flushSync(() => setRoute(routeKey()));
      const hash = window.location.hash.slice(1);
      let target: HTMLElement | null = null;
      try { target = hash ? document.getElementById(decodeURIComponent(hash)) : null; } catch { /* Ignore malformed fragments. */ }
      mainRef.current?.focus({ preventScroll: true });
      if (restoreY !== undefined) window.scrollTo({ top: restoreY, behavior: 'instant' });
      else if (target) target.scrollIntoView({ behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    };
    transition.current?.skipTransition();
    animation.current?.cancel();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update();
    } else if (document.startViewTransition) {
      // The old page stays visible while React commits the next page.
      const next = document.startViewTransition(update);
      transition.current = next;
      void next.finished.catch(() => {}).finally(() => {
        if (transition.current === next) transition.current = null;
      });
    } else {
      update();
      animation.current = mainRef.current?.animate?.([
        { opacity: 0.35, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' }) ?? null;
    }
  }, []);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    currentEntry.current = window.history.state?.portfolioEntry || crypto.randomUUID();
    window.history.replaceState({ ...window.history.state, portfolioEntry: currentEntry.current }, '');
    const onPopState = () => {
      positions.current.set(currentEntry.current, window.scrollY);
      currentEntry.current = window.history.state?.portfolioEntry || crypto.randomUUID();
      showRoute(positions.current.get(currentEntry.current));
    };
    window.addEventListener('popstate', onPopState);
    // Direct links with fragments must wait until React has mounted their target.
    const frame = requestAnimationFrame(() => {
      try { if (window.location.hash) document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView(); } catch { /* Invalid fragment. */ }
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('popstate', onPopState);
      window.history.scrollRestoration = previousRestoration;
      transition.current?.skipTransition();
      animation.current?.cancel();
    };
  }, [showRoute]);

  const onNavigate = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || !isPortfolioPath(url.pathname)) return;
    event.preventDefault();
    const nextRoute = url.pathname + url.search + url.hash;
    if (nextRoute === routeKey()) return;
    positions.current.set(currentEntry.current, window.scrollY);
    currentEntry.current = crypto.randomUUID();
    window.history.pushState({ portfolioEntry: currentEntry.current }, '', nextRoute);
    showRoute();
  };

  return { path: route.split(/[?#]/)[0].replace(/\/+$/, ''), mainRef, onNavigate };
}
