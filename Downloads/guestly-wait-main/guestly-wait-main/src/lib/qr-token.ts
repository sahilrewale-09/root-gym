/** Extract a table QR token from a scanned URL or bare token string. */
export function extractQrToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("t");
    if (fromQuery) return fromQuery;
  } catch {
    /* not a URL — fall through to bare token */
  }

  if (/^[a-f0-9]+$/i.test(trimmed)) return trimmed;
  return null;
}
