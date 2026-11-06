import { create } from "zustand";
import { SupportedLanguage, TranslationDictionary } from "./types";
import { ar } from "./locales/ar";
import { en } from "./locales/en";

const dictionaries: Record<SupportedLanguage, TranslationDictionary> = {
  ar,
  en,
};

const STORAGE_KEY = "ptuk_language_preference_v1";

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "ar";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") return saved;
  } catch {}
  return "ar";
}

function applyHtmlDirection(lang: SupportedLanguage) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export interface LanguageState {
  language: SupportedLanguage;
  t: TranslationDictionary;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
}

const initialLang = getInitialLanguage();
applyHtmlDirection(initialLang);

export const useLanguageStore = create<LanguageState>((set) => ({
  language: initialLang,
  t: dictionaries[initialLang],
  setLanguage: (lang: SupportedLanguage) => {
    applyHtmlDirection(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    set({ language: lang, t: dictionaries[lang] });
  },
  toggleLanguage: () => {
    set((state) => {
      const nextLang: SupportedLanguage = state.language === "ar" ? "en" : "ar";
      applyHtmlDirection(nextLang);
      try {
        localStorage.setItem(STORAGE_KEY, nextLang);
      } catch {}
      return { language: nextLang, t: dictionaries[nextLang] };
    });
  },
}));

export function useTranslation() {
  const { language, t, setLanguage, toggleLanguage } = useLanguageStore();
  return {
    t,
    language,
    setLanguage,
    toggleLanguage,
    isRtl: language === "ar",
  };
}

export * from "./types";
