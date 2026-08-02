
-- ROLES
CREATE TYPE public.app_role AS ENUM ('staff','manager','owner');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "roles readable by staff" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- new user -> profile (+ first user becomes owner)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TABLES
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number int NOT NULL UNIQUE,
  capacity int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'available',
  qr_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8),'hex'),
  seated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurant_tables TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tables public read" ON public.restaurant_tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tables staff write" ON public.restaurant_tables FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- WAITLIST
CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  phone text,
  party_size int NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  guest_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  seated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waitlist staff all" ON public.waitlist FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- MENU
CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.menu_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.menu_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories staff write" ON public.menu_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'owner'));

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items public read" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "items staff write" ON public.menu_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'owner'));

-- TICKETS
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  waitlist_id uuid REFERENCES public.waitlist(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received',
  total numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets staff all" ON public.tickets FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.ticket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  qty int NOT NULL DEFAULT 1,
  price numeric(10,2) NOT NULL DEFAULT 0,
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_items TO authenticated;
GRANT ALL ON public.ticket_items TO service_role;
ALTER TABLE public.ticket_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket items staff all" ON public.ticket_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- GUEST RPCs (token scoped, security definer)
CREATE OR REPLACE FUNCTION public.allocate_or_queue_guest(p_name text, p_party_size int, p_phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_table public.restaurant_tables%ROWTYPE; v_row public.waitlist%ROWTYPE;
BEGIN
  IF p_party_size < 1 OR p_party_size > 12 THEN RAISE EXCEPTION 'Invalid party size'; END IF;
  INSERT INTO public.waitlist (guest_name, phone, party_size)
  VALUES (trim(p_name), p_phone, p_party_size) RETURNING * INTO v_row;

  SELECT * INTO v_table FROM public.restaurant_tables
   WHERE status = 'available' AND capacity >= p_party_size
   ORDER BY capacity ASC LIMIT 1;

  IF v_table.id IS NOT NULL THEN
    UPDATE public.restaurant_tables SET status='occupied', seated_at=now() WHERE id = v_table.id;
    UPDATE public.waitlist SET status='seated', table_id=v_table.id, seated_at=now()
      WHERE id = v_row.id RETURNING * INTO v_row;
  END IF;

  RETURN public.guest_status_payload(v_row.guest_token);
END; $$;

CREATE OR REPLACE FUNCTION public.guest_status_payload(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.waitlist%ROWTYPE; v_pos int; v_table public.restaurant_tables%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.waitlist WHERE guest_token = p_token;
  IF v_row.id IS NULL THEN RETURN NULL; END IF;
  IF v_row.table_id IS NOT NULL THEN
    SELECT * INTO v_table FROM public.restaurant_tables WHERE id = v_row.table_id;
  END IF;
  SELECT count(*)+1 INTO v_pos FROM public.waitlist
    WHERE status='waiting' AND created_at < v_row.created_at;
  RETURN jsonb_build_object(
    'guest_token', v_row.guest_token,
    'guest_name', v_row.guest_name,
    'party_size', v_row.party_size,
    'status', v_row.status,
    'position', CASE WHEN v_row.status='waiting' THEN v_pos ELSE NULL END,
    'estimated_wait', CASE WHEN v_row.status='waiting' THEN v_pos*8 ELSE 0 END,
    'table_number', v_table.table_number,
    'qr_token', v_table.qr_token
  );
END; $$;

CREATE OR REPLACE FUNCTION public.get_guest_status(p_token text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.guest_status_payload(p_token);
$$;

CREATE OR REPLACE FUNCTION public.free_up_table(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.waitlist%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.waitlist WHERE guest_token = p_token;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Unknown guest'; END IF;
  IF v_row.table_id IS NOT NULL THEN
    UPDATE public.restaurant_tables SET status='available', seated_at=NULL WHERE id = v_row.table_id;
  END IF;
  UPDATE public.waitlist SET status='completed', completed_at=now() WHERE id=v_row.id;
  RETURN public.guest_status_payload(p_token);
END; $$;

CREATE OR REPLACE FUNCTION public.get_table_by_qr(p_qr_token text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id', id, 'table_number', table_number, 'status', status)
  FROM public.restaurant_tables WHERE qr_token = p_qr_token;
$$;

CREATE OR REPLACE FUNCTION public.place_guest_order(p_qr_token text, p_guest_token text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_table public.restaurant_tables%ROWTYPE; v_ticket public.tickets%ROWTYPE;
        v_item jsonb; v_menu public.menu_items%ROWTYPE; v_total numeric(10,2) := 0; v_wid uuid;
BEGIN
  SELECT * INTO v_table FROM public.restaurant_tables WHERE qr_token = p_qr_token;
  IF v_table.id IS NULL THEN RAISE EXCEPTION 'Unknown table'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Empty order'; END IF;
  SELECT id INTO v_wid FROM public.waitlist WHERE guest_token = p_guest_token;

  INSERT INTO public.tickets (table_id, waitlist_id) VALUES (v_table.id, v_wid) RETURNING * INTO v_ticket;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_menu FROM public.menu_items WHERE id = (v_item->>'menu_item_id')::uuid AND is_available;
    IF v_menu.id IS NOT NULL THEN
      INSERT INTO public.ticket_items (ticket_id, menu_item_id, name, qty, price, notes)
      VALUES (v_ticket.id, v_menu.id, v_menu.name, GREATEST(1,(v_item->>'qty')::int), v_menu.price, v_item->>'notes');
      v_total := v_total + v_menu.price * GREATEST(1,(v_item->>'qty')::int);
    END IF;
  END LOOP;

  UPDATE public.tickets SET total = v_total WHERE id = v_ticket.id;
  RETURN jsonb_build_object('ticket_id', v_ticket.id, 'total', v_total);
END; $$;

CREATE OR REPLACE FUNCTION public.get_ticket_public(p_ticket_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', t.id, 'status', t.status, 'total', t.total, 'created_at', t.created_at,
    'table_number', rt.table_number,
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', ti.name,'qty', ti.qty,'price', ti.price,'notes', ti.notes))
                        FROM public.ticket_items ti WHERE ti.ticket_id = t.id), '[]'::jsonb))
  FROM public.tickets t LEFT JOIN public.restaurant_tables rt ON rt.id = t.table_id
  WHERE t.id = p_ticket_id;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_or_queue_guest(text,int,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_status(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.free_up_table(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_by_qr(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_guest_order(text,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_public(uuid) TO anon, authenticated;

-- realtime
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER TABLE public.waitlist REPLICA IDENTITY FULL;
ALTER TABLE public.restaurant_tables REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;

-- SEED
INSERT INTO public.restaurant_tables (table_number, capacity) VALUES
 (1,2),(2,2),(3,4),(4,4),(5,4),(6,6),(7,6),(8,8);

INSERT INTO public.menu_categories (id, name, sort_order) VALUES
 ('11111111-1111-1111-1111-111111111111','Antipasti',1),
 ('22222222-2222-2222-2222-222222222222','Pasta',2),
 ('33333333-3333-3333-3333-333333333333','Secondi',3),
 ('44444444-4444-4444-4444-444444444444','Dolci',4),
 ('55555555-5555-5555-5555-555555555555','Drinks',5);

INSERT INTO public.menu_items (category_id, name, description, price, sort_order) VALUES
 ('11111111-1111-1111-1111-111111111111','Bruschetta Classica','Grilled sourdough, vine tomato, basil, olive oil',9.50,1),
 ('11111111-1111-1111-1111-111111111111','Burrata & Peach','Creamy burrata, grilled peach, aged balsamic',14.00,2),
 ('11111111-1111-1111-1111-111111111111','Calamari Fritti','Lightly fried squid, lemon aioli',13.50,3),
 ('22222222-2222-2222-2222-222222222222','Cacio e Pepe','Tonnarelli, pecorino romano, cracked pepper',18.00,1),
 ('22222222-2222-2222-2222-222222222222','Tagliatelle al Ragù','Slow braised beef ragù, parmesan',22.00,2),
 ('22222222-2222-2222-2222-222222222222','Gnocchi Sorrentina','Potato gnocchi, tomato, fior di latte',19.00,3),
 ('33333333-3333-3333-3333-333333333333','Branzino al Forno','Whole roasted sea bass, salsa verde',31.00,1),
 ('33333333-3333-3333-3333-333333333333','Bistecca 400g','Dry-aged ribeye, rosemary, sea salt',44.00,2),
 ('44444444-4444-4444-4444-444444444444','Tiramisù','Espresso soaked savoiardi, mascarpone',10.00,1),
 ('44444444-4444-4444-4444-444444444444','Affogato','Vanilla gelato, hot espresso',8.00,2),
 ('55555555-5555-5555-5555-555555555555','Negroni','Gin, campari, sweet vermouth',14.00,1),
 ('55555555-5555-5555-5555-555555555555','Chianti Classico','Glass, Tuscany',12.00,2),
 ('55555555-5555-5555-5555-555555555555','Sparkling Water','San Pellegrino 500ml',4.50,3);
