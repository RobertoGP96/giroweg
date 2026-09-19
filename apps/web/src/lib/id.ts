/**
 * UUID v7 generated on the client (domain rule 5): time-ordered, so ids sort
 * by creation and stay unique across devices without a server round trip.
 */
export const uuidv7 = (now: number = Date.now()): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // 48-bit big-endian unix timestamp in ms.
  const ts = BigInt(now);
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn);
  }
  // Version 7 in the high nibble of byte 6, variant 10xx in byte 8.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Current instant in UTC ISO 8601 (domain rule 5). */
export const nowIso = (): string => new Date().toISOString();
