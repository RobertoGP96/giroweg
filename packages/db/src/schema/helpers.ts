import { numeric, timestamp } from "drizzle-orm/pg-core";

/** timestamptz exposed as ISO strings (UTC), matching the zod schemas. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

/** numeric(10,1) as a JS number: odometer values and distances. */
export const distance = (name: string) => numeric(name, { precision: 10, scale: 1, mode: "number" });
