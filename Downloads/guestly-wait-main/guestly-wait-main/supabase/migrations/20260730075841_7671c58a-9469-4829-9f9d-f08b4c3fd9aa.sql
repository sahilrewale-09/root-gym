
CREATE POLICY "owners manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
