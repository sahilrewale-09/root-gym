CREATE OR REPLACE FUNCTION public.get_ticket_public(p_ticket_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', t.id, 'status', t.status, 'total', t.total, 'created_at', t.created_at,
    'table_number', rt.table_number,
    'qr_token', rt.qr_token,
    'guest_name', w.guest_name,
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', ti.name,'qty', ti.qty,'price', ti.price,'notes', ti.notes))
                        FROM public.ticket_items ti WHERE ti.ticket_id = t.id), '[]'::jsonb))
  FROM public.tickets t
  LEFT JOIN public.restaurant_tables rt ON rt.id = t.table_id
  LEFT JOIN public.waitlist w ON w.id = t.waitlist_id
  WHERE t.id = p_ticket_id;
$$;
