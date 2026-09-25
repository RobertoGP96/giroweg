/**
 * Turns a database failure into what the sync protocol carries to the
 * device: a short key it can translate and whether retrying the same record
 * can ever succeed. Pure, so it is unit-tested without a database.
 *
 * Drizzle wraps every driver error in a `DrizzleQueryError` whose message is
 * "Failed query: …"; the Postgres error (SQLSTATE `code`, message raised by
 * our triggers such as "reading_below_previous: …") is its `cause`.
 */

export interface DescribedError {
  /** Snake-case key of the domain rule or SQLSTATE class; else the message. */
  error: string;
  /** Retrying the same record cannot succeed (validation, integrity, permissions). */
  permanent: boolean;
  /** Full text for server logs. */
  detail: string;
  /** SQLSTATE when the failure came from Postgres. */
  code: string | null;
}

const MAX_MESSAGE = 120;

const SQLSTATE_KEYS: Record<string, string> = {
  "23503": "foreign_key_violation",
  "23505": "unique_violation",
  "23514": "check_violation",
  "22P02": "invalid_text_representation",
  "42501": "insufficient_privilege",
  P0001: "raise_exception",
};

interface ErrorLike {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
}

const asErrorLike = (value: unknown): ErrorLike | null =>
  typeof value === "object" && value !== null ? (value as ErrorLike) : null;

/** The innermost error carrying a SQLSTATE, else the innermost error at all. */
const unwrap = (cause: unknown): ErrorLike | null => {
  let current = asErrorLike(cause);
  let deepest = current;
  const seen = new Set<ErrorLike>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current.code === "string" && current.code.length > 0) return current;
    deepest = current;
    current = asErrorLike(current.cause);
  }
  return deepest;
};

export const describeDbError = (cause: unknown): DescribedError => {
  const root = unwrap(cause);
  const message = typeof root?.message === "string" ? root.message : String(cause ?? "error");
  const sqlState = typeof root?.code === "string" && root.code.length > 0 ? root.code : null;
  const ruleKey = /^[a-z_]+:/.test(message) ? (message.split(":")[0] ?? null) : null;
  const permanent = sqlState !== null && (/^(22|23|42)/.test(sqlState) || sqlState === "P0001");
  return {
    error: ruleKey ?? (sqlState ? (SQLSTATE_KEYS[sqlState] ?? `sqlstate_${sqlState.toLowerCase()}`) : message.slice(0, MAX_MESSAGE)),
    permanent,
    detail: message,
    code: sqlState,
  };
};
