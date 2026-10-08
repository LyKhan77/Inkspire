import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { IconDropletFilled } from '@tabler/icons-react';
import { useLanguage } from './language';
import type { useTheme } from './theme';

function inkShape(radius: number, x: number, y: number) {
  const points = Array.from({ length: 40 }, (_, i) => {
    const angle = i * Math.PI * 2 / 40;
    const ripple = 1 + .035 * Math.sin(i * 2.3) + .025 * Math.cos(i * 1.7);
    return `${x + Math.cos(angle) * radius * ripple}px ${y + Math.sin(angle) * radius * ripple}px`;
  });
  return `polygon(${points.join(',')})`;
}

export function ThemeToggle({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { t } = useLanguage();
  const button = useRef<HTMLButtonElement>(null);
  const locked = useRef(false); const mounted = useRef(false);
  const active = useRef<{ view: ViewTransition; target: 'light' | 'dark'; committed: boolean } | null>(null);
  const animation = useRef<Animation | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; active.current?.view.skipTransition(); animation.current?.cancel();
      delete document.documentElement.dataset.inkTransition;
    };
  }, []);
  useEffect(() => {
    const current = active.current;
    if (current?.committed && theme.choice !== current.target) current.view.skipTransition();
  }, [theme.choice]);

  async function toggle() {
    if (locked.current) return;
    const target = theme.theme === 'light' ? 'dark' : 'light';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof document.startViewTransition !== 'function') {
      theme.choose(target); return;
    }
    locked.current = true; setBusy(true);
    const root = document.documentElement;
    const bounds = button.current!.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 1.1;
    let committed = false;
    function commit() {
      if (committed || !mounted.current) return;
      committed = true;
      if (active.current) active.current.committed = true;
      flushSync(() => theme.choose(target));
    }
    try {
      root.dataset.inkTransition = 'true';
      const view = document.startViewTransition(commit);
      active.current = { view, target, committed: false };
      // A skipped/hidden transition rejects ready but still runs the DOM update.
      try {
        await view.ready;
        if (mounted.current) animation.current = root.animate(
          [{ clipPath: inkShape(0, x, y) }, { clipPath: inkShape(radius, x, y) }],
          { duration: 650, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both', pseudoElement: '::view-transition-new(root)' },
        );
      } catch { view.skipTransition(); }
      await view.finished;
    } catch { commit(); }
    finally {
      animation.current?.cancel(); animation.current = null; active.current = null;
      delete root.dataset.inkTransition; locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const label = t(theme.theme === 'light' ? 'Aktifkan dark mode' : 'Aktifkan light mode');
  return <button ref={button} className="ink-toggle" aria-label={label} title={label} aria-pressed={theme.theme === 'dark'} aria-disabled={busy || undefined} onClick={() => void toggle()}>
    <span className="ink-mark" aria-hidden="true"><IconDropletFilled size={28} /></span>
  </button>;
}
