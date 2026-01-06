'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';

type Locale = 'en' | 'fr';

type Messages = Record<string, string>;

const translations: Record<Locale, Messages> = {
  en: {
    'nav.login': 'Log in',
    'nav.getStarted': 'Get started',
    'nav.landing': 'Landing',
    'hero.tagline': 'The vault for your workflows',
    'hero.title.line1': 'Never lose a',
    'hero.title.line2': 'workflow again',
    'hero.subtitle': 'Automatic versioning. Visual diffs. One-click rollback.',
    'hero.cta.primary': 'Start free',
    'hero.cta.secondary': 'Learn more',
    'how.title': "Three steps. That's it.",
    'how.step1.title': 'Connect',
    'how.step1.desc': 'Add your platform URL and API key.',
    'how.step2.title': 'Import',
    'how.step2.desc': 'Select workflows to track.',
    'how.step3.title': 'Relax',
    'how.step3.desc': 'We handle the rest automatically.',
    'features.title': 'What you get out-of-the-box',
    'features.subtitle': 'Versioning, alerts, governance, and more built for ops teams.',
    'auth.login.title': 'Welcome back',
    'auth.login.subtitle': 'Enter your email to sign in with a magic link',
    'auth.login.sent': 'Check your email',
    'auth.login.sentDesc': 'We sent a magic link to',
    'auth.login.tryAnother': 'Try another email',
    'language.label': 'Language',
  },
  fr: {
    'nav.login': 'Connexion',
    'nav.getStarted': 'Commencer',
    'nav.landing': 'Accueil',
    'hero.tagline': 'Le coffre-fort de vos workflows',
    'hero.title.line1': 'Ne perdez plus jamais',
    'hero.title.line2': 'un workflow',
    'hero.subtitle': 'Versioning automatique. Diffs visuels. Rollback en un clic.',
    'hero.cta.primary': 'Essayer gratuitement',
    'hero.cta.secondary': 'En savoir plus',
    'how.title': 'Trois étapes. C’est tout.',
    'how.step1.title': 'Connecter',
    'how.step1.desc': "Ajoutez l’URL de votre plateforme et votre clé d'API.",
    'how.step2.title': 'Importer',
    'how.step2.desc': 'Sélectionnez les workflows à suivre.',
    'how.step3.title': 'Se détendre',
    'how.step3.desc': 'Nous nous occupons du reste automatiquement.',
    'features.title': 'Ce que vous obtenez immédiatement',
    'features.subtitle': 'Versioning, alertes et gouvernance pensés pour les équipes ops.',
    'auth.login.title': 'Bon retour',
    'auth.login.subtitle': 'Entrez votre email pour recevoir un lien magique',
    'auth.login.sent': 'Vérifiez vos emails',
    'auth.login.sentDesc': 'Nous avons envoyé un lien magique à',
    'auth.login.tryAnother': 'Essayer un autre email',
    'language.label': 'Langue',
  },
};

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'flowvault_locale';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'fr') {
      setLocale(stored);
    } else if (navigator.language.startsWith('fr')) {
      setLocale('fr');
    }
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
  };

  const value = useMemo<LanguageContextValue>(() => {
    const translate = (key: string) =>
      translations[locale]?.[key] ?? translations.en[key] ?? key;
    return { locale, setLocale: changeLocale, t: translate };
  }, [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
