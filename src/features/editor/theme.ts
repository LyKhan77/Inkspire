import { useEffect, useState } from 'react';
export type ThemeChoice = 'system' | 'light' | 'dark';
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(() => { try { const stored = localStorage.getItem('inkspire-theme'); return stored === 'light' || stored === 'dark' ? stored : 'system'; } catch { return 'system'; } });
  const [system, setSystem] = useState<'light' | 'dark'>(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  useEffect(() => { if (choice !== 'system') return; const mq = matchMedia('(prefers-color-scheme: dark)'); const sync = () => setSystem(mq.matches ? 'dark' : 'light'); sync(); mq.addEventListener('change', sync); return () => mq.removeEventListener('change', sync); }, [choice]);
  function choose(value: ThemeChoice) { setChoice(value); try { localStorage.setItem('inkspire-theme', value); } catch { /* Preference can remain in memory. */ } }
  return { choice, choose, theme: choice === 'system' ? system : choice };
}
