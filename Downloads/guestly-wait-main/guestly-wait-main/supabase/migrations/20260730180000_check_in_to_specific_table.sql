CREATE OR REPLACE FUNCTION public.check_in_to_specific_table(
  p_name text,
  p_party_size int,
  p_qr_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table public.restaurant_tables%ROWTYPE;
  v_row public.waitlist%ROWTYPE;
BEGIN
  IF p_party_size < 1 OR p_party_size > 12 THEN
    RAISE EXCEPTION 'Invalid party size';
  END IF;

  SELECT * INTO v_table FROM public.restaurant_tables WHERE qr_token = p_qr_token;
  IF v_table.id IS NULL THEN
    RAISE EXCEPTION 'Unknown table';
  END IF;

  IF v_table.status = 'occupied' THEN
    RAISE EXCEPTION 'Table already occupied';
  END IF;

  IF p_party_size > v_table.capacity THEN
    RAISE EXCEPTION 'Table capacity exceeded';
  END IF;

  UPDATE public.restaurant_tables
  SET status = 'occupied', seated_at = now()
  WHERE id = v_table.id;

  INSERT INTO public.waitlist (guest_name, party_size, status, table_id, seated_at)
  VALUES (trim(p_name), p_party_size, 'seated', v_table.id, now())
  RETURNING * INTO v_row;

  RETURN public.guest_status_payload(v_row.guest_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_to_specific_table(text, int, text) TO anon, authenticated;
