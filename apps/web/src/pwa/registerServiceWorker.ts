const SW_URL = "/sw.js";

const isSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator;

/**
 * Registers public/sw.js in production. In development every registration is
 * removed instead: a cached shell would hide Turbopack's fresh chunks.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!isSupported()) return;
  try {
    if (process.env.NODE_ENV !== "production") {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      return;
    }
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    // A worker that finished installing while this tab was open takes over on
    // the next load; asking it to skip waiting makes the update land sooner.
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage("SKIP_WAITING");
        }
      });
    });
  } catch {
    // Registration failing (private mode, unsupported scope) must never break the app.
  }
}
