CREATE TABLE "trip_routes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"segments" jsonb NOT NULL,
	"point_count" integer NOT NULL,
	CONSTRAINT "trip_routes_trip_unique" UNIQUE("trip_id"),
	CONSTRAINT "trip_routes_point_count_min" CHECK ("trip_routes"."point_count" >= 2),
	CONSTRAINT "trip_routes_segments_array" CHECK (jsonb_typeof("trip_routes"."segments") = 'array')
);
--> statement-breakpoint
ALTER TABLE "trip_routes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_routes" ADD CONSTRAINT "trip_routes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_routes" ADD CONSTRAINT "trip_routes_trip_fk" FOREIGN KEY ("trip_id","org_id") REFERENCES "public"."trips"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_routes_org_idx" ON "trip_routes" USING btree ("org_id");--> statement-breakpoint
CREATE POLICY "trip_routes_select" ON "trip_routes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member("trip_routes"."org_id"));--> statement-breakpoint
CREATE POLICY "trip_routes_insert" ON "trip_routes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_org_member("trip_routes"."org_id"));--> statement-breakpoint
CREATE POLICY "trip_routes_update" ON "trip_routes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_member("trip_routes"."org_id")) WITH CHECK (is_org_member("trip_routes"."org_id"));--> statement-breakpoint
CREATE POLICY "trip_routes_delete" ON "trip_routes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_org_admin("trip_routes"."org_id"));