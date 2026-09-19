// Exercises the domain rules enforced in Postgres inside one transaction
// that is always rolled back, so production data is untouched.
import { readFileSync } from "node:fs";
import { Pool, neonConfig } from "@neondatabase/serverless";

const env = Object.fromEntries(
  readFileSync(process.argv[2], "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
neonConfig.webSocketConstructor = globalThis.WebSocket;
const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED });
const client = await pool.connect();

const results = [];
const expectOk = async (label, sql, params = []) => {
  try {
    await client.query("SAVEPOINT sp");
    const r = await client.query(sql, params);
    results.push({ label, ok: true, rows: r.rowCount });
    await client.query("RELEASE SAVEPOINT sp");
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT sp");
    results.push({ label, ok: false, unexpected: e.message.slice(0, 120) });
  }
};
const expectFail = async (label, sql, params = [], match = "") => {
  try {
    await client.query("SAVEPOINT sp");
    await client.query(sql, params);
    await client.query("RELEASE SAVEPOINT sp");
    results.push({ label, ok: false, unexpected: "statement succeeded" });
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT sp");
    results.push({ label, ok: e.message.includes(match), error: e.message.slice(0, 90) });
  }
};

const org = "018f6d2a-0000-7000-8000-0000000000aa";
const veh = "018f6d2a-0000-7000-8000-0000000000ab";
const r = (n) => `018f6d2a-0000-7000-8000-0000000000${n}`;
const reading = (id, value, at, extra = "") =>
  `insert into readings (id, org_id, created_at, updated_at, vehicle_id, value, recorded_at, source, created_by${extra ? ", " + extra.split("=")[0] : ""})
   values ('${id}', '${org}', now(), now(), '${veh}', ${value}, '${at}', 'manual', 'user-test'${extra ? ", " + extra.split("=")[1] : ""})`;

try {
  await client.query("BEGIN");
  await expectOk("create organization", `insert into organizations (id, name) values ('${org}', 'Test org')`);
  await expectOk("create vehicle", `insert into vehicles (id, org_id, created_at, updated_at, type, name, unit, initial_value) values ('${veh}', '${org}', now(), now(), 'motorcycle', 'Test', 'km', 100)`);
  await expectOk("reading 1000 @ day 1", reading(r("b1"), 1000, "2026-09-10T10:00:00Z"));
  await expectOk("reading 1200 @ day 3", reading(r("b3"), 1200, "2026-09-12T10:00:00Z"));
  await expectFail("rule 2: 900 @ day 2 below previous", reading(r("b2"), 900, "2026-09-11T10:00:00Z"), [], "reading_below_previous");
  await expectFail("rule 2: 1300 @ day 2 above next", reading(r("b4"), 1300, "2026-09-11T10:00:00Z"), [], "reading_above_next");
  await expectOk("rule 2: 1100 @ day 2 in range", reading(r("b5"), 1100, "2026-09-11T10:00:00Z"));
  await expectFail("reset without note rejected", reading(r("b6"), 50, "2026-09-13T10:00:00Z", "odometer_reset=true"), [], "readings_reset_note");
  await expectOk("odometer reset 50 @ day 4 with note", `insert into readings (id, org_id, created_at, updated_at, vehicle_id, value, recorded_at, source, created_by, odometer_reset, note) values ('${r("b7")}', '${org}', now(), now(), '${veh}', 50, '2026-09-13T10:00:00Z', 'manual', 'user-test', true, 'New dial')`);
  await expectOk("reading 80 after reset", reading(r("b8"), 80, "2026-09-14T10:00:00Z"));
  await expectFail("rule 1: value update rejected", `update readings set value = 999 where id = '${r("b1")}'`, [], "readings_are_append_only");
  await expectOk("rule 1: voiding allowed", `update readings set voided_at = now(), void_reason = 'typo' where id = '${r("b5")}'`);
  await expectFail("rule 1: delete rejected", `delete from readings where id = '${r("b1")}'`, [], "readings_are_append_only");
  await expectFail("rule 3: unit change rejected", `update vehicles set unit = 'mi' where id = '${veh}'`, [], "vehicle_unit_immutable");
  await expectOk("rule 5: synced_at stamped by server", `select 1 from readings where id = '${r("b1")}' and synced_at >= now() - interval '1 minute'`);
  await expectOk("admin purge with allow_purge", `set local giroweg.allow_purge = 'on'; delete from organizations where id = '${org}'`);
  const { rows } = await client.query("select count(*)::int as n from pg_policies where schemaname = 'public'");
  results.push({ label: `rls policies in public: ${rows[0].n}`, ok: rows[0].n >= 29 });
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}

for (const res of results) console.log(res.ok ? "PASS" : "FAIL", res.label, res.unexpected ? `-> ${res.unexpected}` : "");
process.exit(results.every((x) => x.ok) ? 0 : 1);
