import type { TFunction } from "i18next";

/**
 * Human text for an outbox error. Server rejections arrive as snake_case
 * keys (domain rules, SQLSTATE classes); transport failures as
 * `push_failed_<status>`; anything else is a network error message. The raw
 * code is always part of the text so the user can report it.
 */
export const syncErrorMessage = (t: TFunction, error: string): string => {
  const http = /^push_failed_(\d{3})$/.exec(error);
  if (http) {
    const status = Number(http[1]);
    const key =
      status === 400 ? "http_400" : status === 401 ? "http_401" : status === 409 ? "http_409" : status >= 500 ? "http_5xx" : "transport";
    return t(`sync.errors.${key}`, { code: error });
  }
  if (/^[a-z_]+$/.test(error)) {
    const known = t(`sync.errors.${error}`, { defaultValue: "" });
    if (known) return known;
  }
  return t("sync.errors.transport", { code: error });
};
