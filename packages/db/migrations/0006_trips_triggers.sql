-- synced_at is server time (domain rule 5), same trigger as the other synced tables.
CREATE TRIGGER trip_routes_synced_at BEFORE INSERT OR UPDATE ON public.trip_routes
FOR EACH ROW EXECUTE FUNCTION public.stamp_synced_at();
--> statement-breakpoint
-- A trip is anchored to its start: the vehicle, the start reading and the
-- start time never change after insert. Once ended, a trip stays ended;
-- corrections are new trips, not reopened ones.
CREATE OR REPLACE FUNCTION public.trips_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.org_id <> OLD.org_id
     OR NEW.vehicle_id <> OLD.vehicle_id
     OR NEW.start_reading_id <> OLD.start_reading_id
     OR NEW.started_at <> OLD.started_at
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'trip_start_immutable: vehicle, start reading and start time cannot change'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.ended_at IS NOT NULL AND NEW.ended_at IS NULL THEN
    RAISE EXCEPTION 'trip_already_ended: an ended trip cannot be reopened'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER trips_guard_update BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.trips_guard_update();
