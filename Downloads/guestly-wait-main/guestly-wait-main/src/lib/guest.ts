export const GUEST_TOKEN_KEY = "tablepe_guest_token";

export function saveGuestToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_TOKEN_KEY, token);
  document.cookie = `${GUEST_TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 12}; SameSite=Lax`;
}

export function readGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(GUEST_TOKEN_KEY);
  if (stored) return stored;
  const match = document.cookie.match(new RegExp(`(?:^|; )${GUEST_TOKEN_KEY}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearGuestToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_TOKEN_KEY);
  document.cookie = `${GUEST_TOKEN_KEY}=; path=/; max-age=0`;
}

export function clearGuestSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("guest_token");
  localStorage.removeItem(GUEST_TOKEN_KEY);
  localStorage.removeItem(QR_TOKEN_KEY);
  localStorage.removeItem(CART_KEY);
  document.cookie = `${GUEST_TOKEN_KEY}=; path=/; max-age=0`;
}

export const money = (value: number | string) =>
  `₹${Number(value ?? 0).toFixed(2)}`;

export const QR_TOKEN_KEY = "tablepe_qr_token";

export function saveQrToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QR_TOKEN_KEY, token);
}

export function readQrToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(QR_TOKEN_KEY);
}

export const CART_KEY = "tablepe_cart";

export type CartLine = {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
};
