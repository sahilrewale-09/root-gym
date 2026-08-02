-- Migration: Create update_user_role RPC function
CREATE OR REPLACE FUNCTION public.update_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing role for user to avoid duplicate key conflict
  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;

  -- Insert new role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, p_new_role::public.app_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, text) TO authenticated;
