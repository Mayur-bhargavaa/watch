'use client';

import { useLayoutEffect } from 'react';

/**
 * Scroll motion for the public landing page. Mount it once inside an element marked `data-landing-root`.
 *
 * 1. 3D scroll: every top-level block of a section tilts back in space (perspective + rotateX + depth + scale) and rises into
 *    place as it enters the screen, and tips slightly away again as it leaves the top. Two-column layouts also swing in from
 *    the sides (rotateY). It is driven by the scroll position on every frame (one rAF loop, only for blocks near the screen), so
 *    it follows the scroll exactly, nothing loads and nothing jumps. Once a block is settled its transform is cleared.
 * 2. Reveal: grid items, list items and footer blocks fade and rise in with a short stagger (CSS `.rv`, see globals.css).
 *
 * 3. Full-page sections: each section fills the screen below the sticky header and the browser's own scroll snapping settles
 *    on one section at a time (CSS in globals.css, switched on by `data-landing-snap` on <html>), like turning pages. Mandatory
 *    snapping is used only on large screens; phones and short windows use the gentler "proximity" mode, and a section taller than
 *    the screen can still be scrolled through normally.
 *
 * Nothing is hidden or moved for visitors with `prefers-reduced-motion`, without IntersectionObserver, or before this runs
 * (the page is complete server-rendered HTML). Everything is undone on unmount.
 */
const BLOCKS = 'section > *';
const REVEAL = 'footer > *, section .grid > *, section ul > li, [data-rv]';

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Block {
  el: HTMLElement;
  cols: Array<{ el: HTMLElement; side: -1 | 1 }>;
}

export function RevealOnScroll() {
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const root = document.querySelector<HTMLElement>('[data-landing-root]');
    if (!root) return;

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const tilt = coarse ? 8 : 14;
    const swing = coarse ? 0 : 9;
    const cleanups: Array<() => void> = [];
    // full-page sections: tell the CSS the header height and switch the snapping on
    const html = document.documentElement;
    const header = root.querySelector<HTMLElement>('header');
    const syncHeader = () => root.style.setProperty('--landing-header', `${header?.offsetHeight ?? 64}px`);
    syncHeader();
    const headerObserver = typeof ResizeObserver !== 'undefined' && header ? new ResizeObserver(syncHeader) : null;
    if (header && headerObserver) headerObserver.observe(header);
    html.setAttribute('data-landing-snap', '');
    const prevScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';

    // ---------------------------------------------------------------- 2. staggered reveal for grid / list / footer items
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          reveal.unobserve(el);
          el.classList.add('rv-in');
          const done = (ev: TransitionEvent) => {
            if (ev.target !== el || ev.propertyName !== 'opacity') return;
            el.removeEventListener('transitionend', done);
            el.classList.remove('rv', 'rv-in');
            el.style.removeProperty('--rv-delay');
          };
          el.addEventListener('transitionend', done);
          cleanups.push(() => el.removeEventListener('transitionend', done));
        }
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' }
    );
    const tagged = new Set<HTMLElement>();
    root.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => {
      if (tagged.has(el) || el.closest('header')) return;
      tagged.add(el);
      const parent = el.parentElement;
      const grouped = parent && (parent.classList.contains('grid') || parent.tagName === 'UL');
      const index = grouped && parent ? Array.prototype.indexOf.call(parent.children, el) : 0;
      el.style.setProperty('--rv-delay', `${Math.min(index, 6) * 70}ms`);
      el.classList.add('rv');
      reveal.observe(el);
    });

    // ---------------------------------------------------------------- 1. scroll-driven 3D blocks
    const blocks: Block[] = [];
    root.querySelectorAll<HTMLElement>(BLOCKS).forEach((el) => {
      if (el.closest('header') || getComputedStyle(el).position === 'absolute') return;
      const cols: Block['cols'] = [];
      const grid = el.classList.contains('grid') ? el : el.querySelector<HTMLElement>(':scope > .grid');
      if (grid && swing > 0 && grid.children.length >= 2) {
        const kids = Array.from(grid.children) as HTMLElement[];
        kids.forEach((k, i) => {
          if (k.getBoundingClientRect().height > 220 && getComputedStyle(k).position !== 'absolute') cols.push({ el: k, side: i % 2 === 0 ? -1 : 1 });
        });
      }
      blocks.push({ el, cols });
    });

    const active = new Set<Block>();
    const byEl = new Map<HTMLElement, Block>(blocks.map((b) => [b.el, b]));
    const near = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const b = byEl.get(e.target as HTMLElement);
          if (!b) continue;
          if (e.isIntersecting) active.add(b);
          else {
            active.delete(b);
            settle(b);
          }
        }
        schedule();
      },
      { rootMargin: '25% 0px 25% 0px' }
    );
    blocks.forEach((b) => near.observe(b.el));

    function settle(b: Block) {
      b.el.style.transform = '';
      b.el.style.opacity = '';
      b.el.style.transformOrigin = '';
      b.el.style.willChange = '';
      b.cols.forEach((c) => (c.el.style.transform = ''));
    }

    function render(b: Block, vh: number) {
      const r = b.el.getBoundingClientRect();
      const enter = easeOut(clamp((vh * 0.98 - r.top) / (vh * 0.5)));
      const exit = clamp((vh * 0.3 - r.bottom) / (vh * 0.35));
      if (enter >= 0.999 && exit <= 0.001) {
        settle(b);
        return;
      }
      const d = 1 - enter;
      b.el.style.willChange = 'transform, opacity';
      b.el.style.transformOrigin = '50% 0%';
      b.el.style.transform =
        `perspective(1400px) translate3d(0, ${(d * 64).toFixed(1)}px, ${(-d * 120 - exit * 40).toFixed(1)}px) ` +
        `rotateX(${(d * tilt - exit * 5).toFixed(2)}deg) scale(${(1 - d * 0.06 - exit * 0.03).toFixed(4)})`;
      b.el.style.opacity = String(clamp(enter * 1.35) * (1 - 0.3 * exit));
      for (const c of b.cols) {
        c.el.style.transform = `perspective(1400px) rotateY(${(c.side * d * swing).toFixed(2)}deg)`;
      }
    }

    let queued = false;
    function frame() {
      queued = false;
      const vh = window.innerHeight || 800;
      active.forEach((b) => render(b, vh));
    }
    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(frame);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // first paint: blocks below the fold start tilted (layout effect runs before the browser paints)
    const vh0 = window.innerHeight || 800;
    blocks.forEach((b) => {
      const r = b.el.getBoundingClientRect();
      if (r.top < vh0 * 1.25 && r.bottom > -vh0 * 0.25) active.add(b);
    });
    frame();

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      near.disconnect();
      reveal.disconnect();
      cleanups.forEach((fn) => fn());
      blocks.forEach(settle);
      tagged.forEach((el) => {
        el.classList.remove('rv', 'rv-in');
        el.style.removeProperty('--rv-delay');
      });
      document.documentElement.style.scrollBehavior = prevScrollBehavior;
      html.removeAttribute('data-landing-snap');
      headerObserver?.disconnect();
      root.style.removeProperty('--landing-header');
    };
  }, []);

  return null;
}
