import "server-only";

/** Reads `Authorization: Bearer <jwt>` from a request. */
export const readBearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
};
