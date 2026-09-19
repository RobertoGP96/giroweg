/**
 * Runs before hydration to apply the persisted theme and avoid a flash.
 * Keep in sync with ThemeProvider (same storage key and values).
 */
export const THEME_STORAGE_KEY = "gw-theme";

export const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var p=localStorage.getItem(k)||"dark";var t=p==="auto"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;document.documentElement.dataset.theme=t;}catch(e){}})();`;
