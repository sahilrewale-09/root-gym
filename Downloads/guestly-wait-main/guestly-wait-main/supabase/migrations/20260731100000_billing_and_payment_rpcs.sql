CREATE OR REPLACE FUNCTION public.request_ticket_payment(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Unknown ticket';
  END IF;
  IF v_ticket.status <> 'served' THEN
    RAISE EXCEPTION 'Ticket not ready for payment';
  END IF;

  UPDATE public.tickets
  SET status = 'payment_pending', updated_at = now()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('id', p_ticket_id, 'status', 'payment_pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.close_table_and_ticket(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Unknown ticket';
  END IF;

  UPDATE public.tickets
  SET status = 'completed', updated_at = now()
  WHERE id = p_ticket_id;

  IF v_ticket.waitlist_id IS NOT NULL THEN
    UPDATE public.waitlist
    SET status = 'completed', completed_at = now()
    WHERE id = v_ticket.waitlist_id;
  END IF;

  IF v_ticket.table_id IS NOT NULL THEN
    UPDATE public.restaurant_tables
    SET status = 'available', seated_at = NULL
    WHERE id = v_ticket.table_id;
  END IF;

  RETURN jsonb_build_object('ticket_id', p_ticket_id, 'status', 'completed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_ticket_payment(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_table_and_ticket(uuid) TO authenticated;
