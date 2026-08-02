import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CART_KEY, money, readGuestToken, readQrToken, saveQrToken, type CartLine } from "@/lib/guest";

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : "",
    waitlistId: typeof search.waitlistId === "string" ? search.waitlistId : "",
  }),
  head: () => {
    const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";
    return {
      meta: [
        { title: `Menu — ${restaurantName}` },
        { name: "description", content: `Browse the ${restaurantName} menu and order straight from your table.` },
        { property: "og:title", content: `Menu — ${restaurantName}` },
        { property: "og:description", content: "Browse the menu and order straight from your table." },
      ],
    };
  },
  component: MenuPage,
});

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_id: string | null;
};

function MenuCardSkeleton() {
  return (
    <article className="surface-card rounded-2xl p-4 animate-pulse">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0 space-y-2.5">
          <div className="h-5 w-2/3 bg-muted rounded-md" />
          <div className="h-4 w-4/5 bg-muted/60 rounded-md" />
          <div className="h-5 w-1/3 bg-primary/20 rounded-md mt-3" />
        </div>
        <div className="h-10 w-20 bg-muted/80 rounded-xl" />
      </div>
    </article>
  );
}

function MenuPage() {
  const { t: qrToken, waitlistId } = Route.useSearch();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(CART_KEY) : null;
    if (raw) {
      try {
        setCart(JSON.parse(raw));
      } catch {
        setCart([]);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }
  }, [cart]);

  useEffect(() => {
    if (qrToken) saveQrToken(qrToken);
  }, [qrToken]);

  const { data: table } = useQuery({
    queryKey: ["table-by-qr", qrToken],
    enabled: !!qrToken,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_table_by_qr", { p_qr_token: qrToken });
      if (error) throw error;
      return data as unknown as { id: string; table_number: number } | null;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: menuItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["menu-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_available", true);
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  const filteredItems = useMemo(() => {
    if (activeCat === "all") return menuItems;
    return menuItems.filter((i) => i.category_id === activeCat);
  }, [menuItems, activeCat]);

  const totalCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.qty, 0),
    [cart],
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.qty, 0),
    [cart],
  );

  function addItem(item: MenuItem) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.menu_item_id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          qty: 1,
        },
      ];
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.menu_item_id !== id)
        : prev.map((l) => (l.menu_item_id === id ? { ...l, qty } : l)),
    );
  }

  function setNotes(id: string, notes: string) {
    setCart((prev) => prev.map((l) => (l.menu_item_id === id ? { ...l, notes } : l)));
  }

  async function placeOrder() {
    if (waitlistId) {
      if (cart.length === 0) {
        toast.error("Your cart is empty");
        return;
      }
      setPlacing(true);
      try {
        const cartPayload = cart.map((l) => ({
          menu_item_id: l.menu_item_id,
          name: l.name,
          price: l.price,
          qty: l.qty,
          notes: l.notes ?? null,
        }));

        const { error } = await (supabase.from("waitlist") as any)
          .update({ pre_order_cart: cartPayload })
          .eq("id", waitlistId);

        if (error) {
          toast.error(error.message || "Failed to save pre-order");
          return;
        }

        toast.success("Order saved! We'll start cooking as soon as you are seated.");
        setCart([]);
        if (typeof window !== "undefined") {
          localStorage.removeItem(CART_KEY);
        }
        setCartOpen(false);
        navigate({ to: '/waitlist-status', replace: true });
      } catch (err: any) {
        toast.error(err?.message || "Could not save pre-order");
      } finally {
        setPlacing(false);
      }
      return;
    }

    const effectiveQrToken = qrToken || readQrToken();
    if (!effectiveQrToken) {
      toast.error("Scan your table QR code to order");
      return;
    }
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setPlacing(true);
    try {
      const guestToken = readGuestToken() ?? "";
      const { data, error } = await supabase.rpc("place_guest_order", {
        p_qr_token: effectiveQrToken,
        p_guest_token: guestToken,
        p_items: cart.map((l) => ({
          menu_item_id: l.menu_item_id,
          qty: l.qty,
          notes: l.notes ?? null,
        })),
      });

      if (error) {
        toast.error(error.message || "Could not place the order");
        return;
      }

      if (!data) {
        toast.error("Could not place the order: Empty server response");
        return;
      }

      const payload = data as unknown as { ticket_id?: string; id?: string };
      const ticketId = payload.ticket_id || payload.id;

      if (!ticketId) {
        toast.error("Invalid response from server when creating ticket");
        return;
      }

      setCart([]);
      if (typeof window !== "undefined") {
        localStorage.removeItem(CART_KEY);
      }
      setCartOpen(false);

      toast.success("Order placed successfully!");

      navigate({
        to: "/order/$ticketId",
        params: { ticketId },
        search: { t: effectiveQrToken },
        replace: true,
      });
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred while placing your order");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background pb-32">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate font-display text-lg font-semibold">{import.meta.env.VITE_RESTAURANT_NAME || "Tablepe"}</span>
            {table && (
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                Table {table.table_number}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Open cart"
            className="relative h-11 w-11 shrink-0 active:scale-95"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag className="h-5 w-5" />
            {totalCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {totalCount}
              </span>
            )}
          </Button>
        </div>

        <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3">
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`touch-target shrink-0 rounded-full px-4 text-sm font-medium transition-colors active:scale-95 ${
                activeCat === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </header>

      {!qrToken && !waitlistId && (
        <div className="mx-auto mt-4 w-full max-w-3xl px-4">
          <div className="rounded-xl border border-warning bg-warning/20 p-4 text-sm text-warning-foreground">
            Browsing only — scan the QR code on your table to place an order.
          </div>
        </div>
      )}

      {waitlistId && (
        <div className="mx-auto mt-4 w-full max-w-3xl px-4">
          <div className="rounded-xl border border-primary bg-primary/15 p-4 text-sm font-medium text-foreground">
            ✨ <strong>Pre-Ordering for Waitlist:</strong> Choose your dishes now and we'll send them to the kitchen automatically when you get seated!
          </div>
        </div>
      )}

      <section className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 px-4 py-5 md:grid-cols-2">
        {itemsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <MenuCardSkeleton key={i} />)
        ) : (
          filteredItems.map((item) => (
            <article key={item.id} className="surface-card rounded-2xl p-4 transition-all duration-200">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{item.name}</h2>
                  {item.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  )}
                  <p className="mt-2 font-display text-lg font-semibold text-primary">
                    {money(item.price)}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!item.is_available}
                  onClick={() => addItem(item)}
                  className="touch-target shrink-0 transition-all duration-200 active:scale-95 shadow-sm"
                >
                  {item.is_available ? "+ Add" : "86'd"}
                </Button>
              </div>
            </article>
          ))
        )}
      </section>

      {totalCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-background/90 backdrop-blur-md border-t border-border shadow-2xl">
          <button
            onClick={() => setCartOpen(true)}
            className="mx-auto flex w-full max-w-md items-center justify-between rounded-2xl bg-primary px-6 py-4 text-primary-foreground font-semibold shadow-xl transition-all duration-200 active:scale-95"
          >
            <span className="text-base font-semibold">
              {totalCount} {totalCount === 1 ? "item" : "items"} · {money(subtotal)}
            </span>
            <span className="text-base font-bold flex items-center gap-1">
              {waitlistId ? "View Pre-Order Cart →" : "View Cart →"}
            </span>
          </button>
        </div>
      )}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl">Your order</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4">
            {cart.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Your cart is empty.
              </p>
            )}
            {cart.map((l) => (
              <div key={l.menu_item_id} className="rounded-xl border border-border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.name}</p>
                    <p className="text-sm text-muted-foreground">{money(l.price * l.qty)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Decrease quantity"
                      className="h-11 w-11 active:scale-95"
                      onClick={() => setQty(l.menu_item_id, l.qty - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center font-semibold">{l.qty}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Increase quantity"
                      className="h-11 w-11 active:scale-95"
                      onClick={() => setQty(l.menu_item_id, l.qty + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="Notes (no onions, extra spicy…)"
                  value={l.notes ?? ""}
                  onChange={(e) => setNotes(l.menu_item_id, e.target.value)}
                  className="mt-3 h-11"
                />
              </div>
            ))}

            {cart.length > 0 && (
              <>
                <div className="flex items-center justify-between border-t border-border pt-4 text-base font-semibold">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <Button
                  onClick={placeOrder}
                  disabled={placing || (!qrToken && !waitlistId)}
                  className="h-14 w-full text-base active:scale-95 font-bold"
                >
                  {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {waitlistId ? "Save Pre-Order" : "Place Order"}
                </Button>
              </>
            )}
            <div className="pt-2 text-center">
              <Link to={waitlistId ? "/waitlist-status" : "/status"} className="text-sm text-muted-foreground underline">
                Back to my status
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
