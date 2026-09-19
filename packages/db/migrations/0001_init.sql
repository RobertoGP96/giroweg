CREATE TYPE "public"."distance_unit" AS ENUM('km', 'mi', 'h');--> statement-breakpoint
CREATE TYPE "public"."expense_type" AS ENUM('fuel', 'toll', 'other');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."reading_source" AS ENUM('manual', 'ocr', 'trip');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('motorcycle', 'car', 'pickup', 'van', 'truck', 'bicycle', 'machinery');--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"model" text,
	"year" integer,
	"plate" text,
	"photo_path" text,
	"unit" "distance_unit" NOT NULL,
	"initial_value" numeric(10, 1) DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "vehicles_id_org_unique" UNIQUE("id","org_id")
);
--> statement-breakpoint
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "readings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"value" numeric(10, 1) NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"source" "reading_source" NOT NULL,
	"photo_path" text,
	"note" text,
	"created_by" text NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"odometer_reset" boolean DEFAULT false NOT NULL,
	CONSTRAINT "readings_id_org_unique" UNIQUE("id","org_id"),
	CONSTRAINT "readings_value_nonnegative" CHECK ("readings"."value" >= 0),
	CONSTRAINT "readings_void_reason" CHECK ("readings"."voided_at" IS NULL OR "readings"."void_reason" IS NOT NULL),
	CONSTRAINT "readings_reset_note" CHECK ("readings"."odometer_reset" = false OR "readings"."note" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"start_reading_id" uuid NOT NULL,
	"end_reading_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"gps_distance" numeric(10, 1),
	"reason" text,
	"stops" integer DEFAULT 0 NOT NULL,
	"pauses" integer DEFAULT 0 NOT NULL,
	"paused_seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "trips_ended_after_started" CHECK ("trips"."ended_at" IS NULL OR "trips"."ended_at" >= "trips"."started_at"),
	CONSTRAINT "trips_counters_nonnegative" CHECK ("trips"."stops" >= 0 AND "trips"."pauses" >= 0 AND "trips"."paused_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" "expense_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"litres" numeric(8, 2),
	"reading_id" uuid,
	"receipt_path" text,
	"note" text,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "expenses_amount_nonnegative" CHECK ("expenses"."amount" >= 0),
	CONSTRAINT "expenses_litres_nonnegative" CHECK ("expenses"."litres" IS NULL OR "expenses"."litres" >= 0)
);
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "maintenance_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"reading_id" uuid,
	"at_value" numeric(10, 1) NOT NULL,
	"done_at" timestamp with time zone NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "maintenance_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "maintenance_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"name" text NOT NULL,
	"every_units" numeric(10, 1),
	"every_days" integer,
	"remind_units_before" numeric(10, 1) DEFAULT 300 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "maintenance_rules_id_org_unique" UNIQUE("id","org_id"),
	CONSTRAINT "maintenance_rules_interval" CHECK ("maintenance_rules"."every_units" IS NOT NULL OR "maintenance_rules"."every_days" IS NOT NULL),
	CONSTRAINT "maintenance_rules_positive" CHECK (("maintenance_rules"."every_units" IS NULL OR "maintenance_rules"."every_units" > 0) AND ("maintenance_rules"."every_days" IS NULL OR "maintenance_rules"."every_days" > 0))
);
--> statement-breakpoint
ALTER TABLE "maintenance_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_vehicle_fk" FOREIGN KEY ("vehicle_id","org_id") REFERENCES "public"."vehicles"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_fk" FOREIGN KEY ("vehicle_id","org_id") REFERENCES "public"."vehicles"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_start_reading_fk" FOREIGN KEY ("start_reading_id","org_id") REFERENCES "public"."readings"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_end_reading_fk" FOREIGN KEY ("end_reading_id","org_id") REFERENCES "public"."readings"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicle_fk" FOREIGN KEY ("vehicle_id","org_id") REFERENCES "public"."vehicles"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reading_fk" FOREIGN KEY ("reading_id","org_id") REFERENCES "public"."readings"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD CONSTRAINT "maintenance_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD CONSTRAINT "maintenance_events_vehicle_fk" FOREIGN KEY ("vehicle_id","org_id") REFERENCES "public"."vehicles"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD CONSTRAINT "maintenance_events_rule_fk" FOREIGN KEY ("rule_id","org_id") REFERENCES "public"."maintenance_rules"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD CONSTRAINT "maintenance_events_reading_fk" FOREIGN KEY ("reading_id","org_id") REFERENCES "public"."readings"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_rules" ADD CONSTRAINT "maintenance_rules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_rules" ADD CONSTRAINT "maintenance_rules_vehicle_fk" FOREIGN KEY ("vehicle_id","org_id") REFERENCES "public"."vehicles"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user_idx" ON "memberships" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vehicles_org_idx" ON "vehicles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "readings_vehicle_recorded_idx" ON "readings" USING btree ("vehicle_id","recorded_at");--> statement-breakpoint
CREATE INDEX "trips_vehicle_started_idx" ON "trips" USING btree ("vehicle_id","started_at");--> statement-breakpoint
CREATE INDEX "expenses_vehicle_occurred_idx" ON "expenses" USING btree ("vehicle_id","occurred_at");--> statement-breakpoint
CREATE INDEX "maintenance_events_rule_done_idx" ON "maintenance_events" USING btree ("rule_id","done_at");--> statement-breakpoint
CREATE INDEX "maintenance_rules_vehicle_idx" ON "maintenance_rules" USING btree ("vehicle_id");--> statement-breakpoint
CREATE POLICY "memberships_select" ON "memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member("memberships"."org_id"));--> statement-breakpoint
CREATE POLICY "memberships_insert" ON "memberships" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_org_admin("memberships"."org_id"));--> statement-breakpoint
CREATE POLICY "memberships_update" ON "memberships" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_admin("memberships"."org_id")) WITH CHECK (is_org_admin("memberships"."org_id"));--> statement-breakpoint
CREATE POLICY "memberships_delete" ON "memberships" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_org_admin("memberships"."org_id"));--> statement-breakpoint
CREATE POLICY "organizations_select" ON "organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member("organizations"."id"));--> statement-breakpoint
CREATE POLICY "organizations_update" ON "organizations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_admin("organizations"."id")) WITH CHECK (is_org_admin("organizations"."id"));--> statement-breakpoint
CREATE POLICY "vehicles_select" ON "vehicles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member("vehicles"."org_id"));--> statement-breakpoint
CREATE POLICY "vehicles_insert" ON "vehicles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_org_member("vehicles"."org_id"));--> statement-breakpoint
CREATE POLICY "vehicles_update" ON "vehicles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_member("vehicles"."org_id")) WITH CHECK (is_org_member("vehicles"."org_id"));--> statement-breakpoint
CREATE POLICY "vehicles_delete" ON "vehicles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_org_admin("vehicles"."org_id"));--> statement-breakpoint
CREATE POLICY "readings_select" ON "readings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member("readings"."org_id"));--> statement-breakpoint
CREATE POLICY "readings_insert" ON "readings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_org_member("readings"."org_id"));--> statement-breakpoint
CREATE POLICY "readings_update" ON "readings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_member("readings"."org_id")) WITH CHECK (is_org_member("readings"."org_id"));--> statement-breakpoint
CREATE POLICY "trips_select" ON "trips" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member("trips"."org_id"));--> statement-breakpoint
CREATE POLICY "trips_insert" ON "trips" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_org_member("trips"."org_id"));--> statement-breakpoint
CREATE POLICY "trips_update" ON "trips" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_member("trips"."org_id")) WITH CHECK (is_org_member("trips"."org_id"));--> statement-breakpoint
CREATE POLICY "trips_delete" ON "trips" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_org_admin("trips"."org_id"));--> statement-breakpoint
CREATE POLICY "expenses_select" ON "expenses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member("expenses"."org_id"));--> statement-breakpoint
CREATE POLICY "expenses_insert" ON "expenses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_org_member("expenses"."org_id"));--> statement-breakpoint
CREATE POLICY "expenses_update" ON "expenses" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_member("expenses"."org_id")) WITH CHECK (is_org_member("expenses"."org_id"));--> statement-breakpoint
CREATE POLICY "expenses_delete" ON "expenses" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_org_member("expenses"."org_id"));--> statement-breakpoint
CREATE POLICY "maintenance_events_select" ON "maintenance_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member("maintenance_events"."org_id"));--> statement-breakpoint
CREATE POLICY "maintenance_events_insert" ON "maintenance_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_org_member("maintenance_events"."org_id"));--> statement-breakpoint
CREATE POLICY "maintenance_events_update" ON "maintenance_events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_member("maintenance_events"."org_id")) WITH CHECK (is_org_member("maintenance_events"."org_id"));--> statement-breakpoint
CREATE POLICY "maintenance_events_delete" ON "maintenance_events" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_org_admin("maintenance_events"."org_id"));--> statement-breakpoint
CREATE POLICY "maintenance_rules_select" ON "maintenance_rules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member("maintenance_rules"."org_id"));--> statement-breakpoint
CREATE POLICY "maintenance_rules_insert" ON "maintenance_rules" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_org_member("maintenance_rules"."org_id"));--> statement-breakpoint
CREATE POLICY "maintenance_rules_update" ON "maintenance_rules" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_member("maintenance_rules"."org_id")) WITH CHECK (is_org_member("maintenance_rules"."org_id"));--> statement-breakpoint
CREATE POLICY "maintenance_rules_delete" ON "maintenance_rules" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_org_admin("maintenance_rules"."org_id"));