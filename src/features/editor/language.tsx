import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { translate } from './messages';
export type Language = 'id' | 'en';
const storageKey = 'inkspire-language';
function initialLanguage(): Language {
  try { return localStorage.getItem(storageKey) === 'en' ? 'en' : 'id'; } catch { return 'id'; }
}
const LanguageContext = createContext<{ language: Language; choose(value: Language): void; t(message: string): string } | null>(null);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'id' ? 'Inkspire — Canvas lokal' : 'Inkspire — Local canvas';
    try { localStorage.setItem(storageKey, language); } catch { /* Preference failure must not block canvas. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, choose: setLanguage, t: message => translate(language, message) }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('LanguageProvider missing');
  return value;
}
