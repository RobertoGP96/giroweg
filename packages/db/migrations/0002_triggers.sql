-- synced_at is server time; recorded_at / created_at stay device time (domain rule 5).
CREATE OR REPLACE FUNCTION public.stamp_synced_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.synced_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER vehicles_synced_at BEFORE INSERT OR UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.stamp_synced_at();
--> statement-breakpoint
CREATE TRIGGER readings_synced_at BEFORE INSERT OR UPDATE ON public.readings
FOR EACH ROW EXECUTE FUNCTION public.stamp_synced_at();
--> statement-breakpoint
CREATE TRIGGER trips_synced_at BEFORE INSERT OR UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.stamp_synced_at();
--> statement-breakpoint
CREATE TRIGGER expenses_synced_at BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.stamp_synced_at();
--> statement-breakpoint
CREATE TRIGGER maintenance_rules_synced_at BEFORE INSERT OR UPDATE ON public.maintenance_rules
FOR EACH ROW EXECUTE FUNCTION public.stamp_synced_at();
--> statement-breakpoint
CREATE TRIGGER maintenance_events_synced_at BEFORE INSERT OR UPDATE ON public.maintenance_events
FOR EACH ROW EXECUTE FUNCTION public.stamp_synced_at();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER organizations_touch_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
--> statement-breakpoint
-- Domain rule 2: a reading can never be below the last valid reading before
-- it nor above the next one. An explicit odometer change (odometer_reset)
-- restarts the sequence: it has no lower bound and readings before it are
-- not bounded by it. Voided readings never take part.
CREATE OR REPLACE FUNCTION public.readings_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  prev_value numeric;
  next_value numeric;
  next_reset boolean;
BEGIN
  IF NEW.voided_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NOT NEW.odometer_reset THEN
    SELECT r.value INTO prev_value
    FROM public.readings r
    WHERE r.vehicle_id = NEW.vehicle_id
      AND r.voided_at IS NULL
      AND r.id <> NEW.id
      AND r.recorded_at < NEW.recorded_at
    ORDER BY r.recorded_at DESC
    LIMIT 1;

    IF prev_value IS NOT NULL AND NEW.value < prev_value THEN
      RAISE EXCEPTION 'reading_below_previous: % is below the previous valid reading %', NEW.value, prev_value
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  SELECT r.value, r.odometer_reset INTO next_value, next_reset
  FROM public.readings r
  WHERE r.vehicle_id = NEW.vehicle_id
    AND r.voided_at IS NULL
    AND r.id <> NEW.id
    AND r.recorded_at > NEW.recorded_at
  ORDER BY r.recorded_at ASC
  LIMIT 1;

  IF next_value IS NOT NULL AND NOT next_reset AND NEW.value > next_value THEN
    RAISE EXCEPTION 'reading_above_next: % is above the next valid reading %', NEW.value, next_value
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER readings_validate BEFORE INSERT ON public.readings
FOR EACH ROW EXECUTE FUNCTION public.readings_validate();
--> statement-breakpoint
-- Domain rule 1: readings are append-only. No deletes; an update may only
-- void the reading (voided_at + void_reason) or attach the photo once the
-- upload finishes. Everything else is rejected. The only exception is an
-- administrative purge (deleting an organization) run by the database owner
-- with `SET LOCAL giroweg.allow_purge = 'on'` in the same transaction.
CREATE OR REPLACE FUNCTION public.readings_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('giroweg.allow_purge', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'readings_are_append_only: readings cannot be deleted, void them instead'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.id <> OLD.id
     OR NEW.org_id <> OLD.org_id
     OR NEW.vehicle_id <> OLD.vehicle_id
     OR NEW.value <> OLD.value
     OR NEW.recorded_at <> OLD.recorded_at
     OR NEW.source <> OLD.source
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.created_by <> OLD.created_by
     OR NEW.odometer_reset <> OLD.odometer_reset
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'readings_are_append_only: only voided_at, void_reason and photo_path may change'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.photo_path IS DISTINCT FROM OLD.photo_path AND OLD.photo_path IS NOT NULL THEN
    RAISE EXCEPTION 'readings_are_append_only: the photo can only be attached once'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.voided_at IS NOT NULL AND (NEW.voided_at IS DISTINCT FROM OLD.voided_at OR NEW.void_reason IS DISTINCT FROM OLD.void_reason) THEN
    RAISE EXCEPTION 'reading_already_voided'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER readings_append_only BEFORE UPDATE OR DELETE ON public.readings
FOR EACH ROW EXECUTE FUNCTION public.readings_append_only();
--> statement-breakpoint
-- Domain rule 3: the unit of a vehicle is immutable once it has a reading.
CREATE OR REPLACE FUNCTION public.vehicles_unit_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.unit <> OLD.unit AND EXISTS (SELECT 1 FROM public.readings r WHERE r.vehicle_id = OLD.id) THEN
    RAISE EXCEPTION 'vehicle_unit_immutable: the unit cannot change once the vehicle has readings'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER vehicles_unit_immutable BEFORE UPDATE OF unit ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.vehicles_unit_immutable();
--> statement-breakpoint
-- A user is an organization of one person: create the org and its owner
-- membership in one transaction for the signed-in Neon Auth user.
CREATE OR REPLACE FUNCTION public.create_organization(org_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id uuid;
  uid text;
BEGIN
  uid := auth.user_id();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO public.organizations (name) VALUES (org_name) RETURNING id INTO new_id;
  INSERT INTO public.memberships (org_id, user_id, role) VALUES (new_id, uid, 'owner');
  RETURN new_id;
END
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_organization(text) TO authenticated;
