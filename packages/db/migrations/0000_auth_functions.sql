-- Roles that Neon binds to end-user JWTs. Neon Auth / Data API create them;
-- make sure they exist on a fresh branch so the policies below can be created.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    CREATE ROLE anonymous NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
--> statement-breakpoint
-- Membership checks used by every row-level security policy. Written in
-- plpgsql so `memberships` (created in 0001) and `auth.user_id()` (provided by
-- the Neon Data API from the JWT subject) resolve at call time.
-- SECURITY DEFINER avoids recursive RLS evaluation on memberships itself.
CREATE OR REPLACE FUNCTION public.is_org_member(target_org uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = target_org AND m.user_id = auth.user_id()
  );
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_org_admin(target_org uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = target_org AND m.user_id = auth.user_id() AND m.role IN ('owner', 'admin')
  );
END
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
