import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";

export const DEFAULT_LOCALE = "es";

export const resources = {
  es: { translation: es },
} as const;

let instance: i18n | null = null;

/** Creates (once) the i18next instance with Spanish as the default language. */
export const getI18n = (): i18n => {
  if (instance) return instance;
  instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
};
