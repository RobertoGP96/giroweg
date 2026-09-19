"use client";

import { useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { getI18n } from "./config";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [i18n] = useState(() => getI18n());
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
