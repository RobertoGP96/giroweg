-- Organization bootstrap on behalf of a verified user. The web server
-- verifies the Neon Auth JWT itself (jose + JWKS) and then calls this as the
-- database owner, because Neon's JWT-bound `authenticated` role does not yet
-- accept Neon Auth's EdDSA tokens ("jwk not found"). Only the owner may call
-- it: it is revoked from PUBLIC and from the JWT roles.
CREATE OR REPLACE FUNCTION public.create_organization_for(owner_user_id text, org_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF owner_user_id IS NULL OR length(trim(owner_user_id)) = 0 THEN
    RAISE EXCEPTION 'owner_user_id is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.organizations (name) VALUES (org_name) RETURNING id INTO new_id;
  INSERT INTO public.memberships (org_id, user_id, role) VALUES (new_id, owner_user_id, 'owner');
  RETURN new_id;
END
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.create_organization_for(text, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.create_organization_for(text, text) FROM authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.create_organization_for(text, text) FROM anonymous;
--> statement-breakpoint
-- The JWT-role variant now delegates to the same implementation.
CREATE OR REPLACE FUNCTION public.create_organization(org_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid text;
BEGIN
  uid := auth.user_id();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public.create_organization_for(uid, org_name);
END
$$;
