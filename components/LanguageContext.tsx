import { createContext, useContext, useState, ReactNode } from "react";
import { translations, Language } from "../locales";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (
    key: keyof typeof translations.en,
    params?: Record<string, string | number>,
  ) => string;
  tContent: (item: any, field: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("en");

  const t = (
    key: keyof typeof translations.en,
    params?: Record<string, string | number>,
  ) => {
    let str = translations[language][key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };

  const tContent = (item: any, field: string) => {
    if (!item) return "";
    if (language === "ru") {
      const ruField = `${field}_ru`;
      return item[ruField] || item[field];
    }
    return item[field];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tContent }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
