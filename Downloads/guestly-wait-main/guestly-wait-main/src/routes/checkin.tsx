import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, UtensilsCrossed, TriangleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CART_KEY, clearGuestSession, readGuestToken, readQrToken, saveGuestToken, saveQrToken } from "@/lib/guest";

export const Route = createFileRoute("/checkin")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : "",
  }),
  head: () => {
    const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";
    return {
      meta: [
        { title: `Check In — ${restaurantName}` },
        { name: "description", content: `Join the ${restaurantName} waitlist from your phone and get seated automatically.` },
        { property: "og:title", content: `Check In — ${restaurantName}` },
        { property: "og:description", content: "Join the waitlist from your phone and get seated automatically." },
      ],
    };
  },
  component: CheckIn,
});

const MAX_TABLE_CAPACITY = 8;
const CAPACITY_ERROR = "Table capacity exceeded";

function CheckIn() {
  const { t: qrToken } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [loading, setLoading] = useState(false);
  const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";

  const isTableCheckIn = !!qrToken;

  useEffect(() => {
    const token =
      readGuestToken() ||
      localStorage.getItem("guest_token") ||
      localStorage.getItem("tablepe_guest_token");
    if (!token) return;

    let active = true;
    async function recoverSession() {
      try {
        const { data: rawData, error } = await supabase.rpc("get_guest_status", { p_token: token! });

        if (!active) return;

        if (!error && rawData) {
          const data = rawData as unknown as { status: string; qr_token: string | null };
          if (data.status === "seated") {
            const activeQr = data.qr_token || qrToken || readQrToken() || "";
            navigate({ to: "/menu", search: { t: activeQr, waitlistId: "" }, replace: true });
            return;
          }
          if (data.status === "waiting") {
            navigate({ to: "/status", replace: true });
            return;
          }
        }
      } catch (err) {
        console.error("recoverSession error:", err);
      }

      localStorage.removeItem("guest_token");
      localStorage.removeItem("tablepe_guest_token");
      localStorage.removeItem(CART_KEY);
      clearGuestSession();
      navigate({ to: "/", replace: true });
    }

    void recoverSession();
    return () => {
      active = false;
    };
  }, [qrToken, navigate]);

  const { data: table } = useQuery({
    queryKey: ["table-by-qr-checkin", qrToken],
    enabled: isTableCheckIn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("table_number, capacity")
        .eq("qr_token", qrToken)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const capacityLimit = isTableCheckIn ? (table?.capacity ?? 0) : MAX_TABLE_CAPACITY;
  const oversized = partySize > capacityLimit;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name for the reservation");
      return;
    }
    setLoading(true);

    if (isTableCheckIn) {
      const { data, error } = await supabase.rpc("check_in_to_specific_table", {
        p_name: name.trim(),
        p_party_size: partySize,
        p_qr_token: qrToken,
      });
      setLoading(false);

      if (error) {
        if (error.message.includes("Table already occupied")) {
          toast.error(
            "This table is currently occupied. If this is a mistake, please speak to the staff.",
          );
          return;
        }
        if (error.message.includes("Table capacity exceeded")) {
          toast.error("This table is too small for your party size. Please speak to the host.");
          return;
        }
        toast.error(error.message ?? "Could not check you in");
        return;
      }

      if (!data) {
        toast.error("Could not check you in");
        return;
      }

      const payload = data as unknown as { guest_token: string };
      saveGuestToken(payload.guest_token);
      saveQrToken(qrToken);
      toast.success("You're seated! Opening the menu…");
      navigate({ to: "/menu", search: { t: qrToken, waitlistId: "" }, replace: true });
      return;
    }

    const guestToken =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `gt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const { data, error } = await supabase
      .from("waitlist")
      .insert([
        {
          guest_name: name.trim(),
          party_size: Number(partySize),
          status: "waiting",
          phone: phone.trim() || null,
          guest_token: guestToken,
        } as any,
      ])
      .select()
      .single();

    setLoading(false);

    if (error || !data) {
      toast.error(error?.message ?? "Could not check you in");
      return;
    }

    const payload = data as unknown as { id: string; guest_token?: string };
    const activeToken = payload.guest_token || payload.id || guestToken;
    saveGuestToken(activeToken);
    if (payload.id) {
      localStorage.setItem("active_waitlist_id", payload.id);
    }
    toast.success("You're on the waitlist!");
    navigate({ to: "/waitlist-status", replace: true });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background pb-32">
      <div className="mx-auto w-full max-w-md px-5 pt-10">
        <div className="flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-5 w-5 shrink-0" />
          <span className="font-display text-xl font-semibold text-foreground">Tablepe</span>
        </div>

        {isTableCheckIn ? (
          <>
            <h1 className="mt-6 text-3xl font-semibold leading-tight">Welcome!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please enter your name and party size to open the menu
              {table ? ` for Table ${table.table_number}` : ""}.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-3xl font-semibold leading-tight">Welcome in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tell us who you are and we'll find you a table — or save your place in line.
            </p>
          </>
        )}

        <form id="checkin-form" onSubmit={submit} className="mt-7 space-y-6">
          <div className="surface-card space-y-5 rounded-2xl p-5">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoFocus
                autoComplete="name"
                placeholder="e.g. Marco"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-14 text-base"
              />
            </div>

            {!isTableCheckIn && (
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="For a text when your table is ready"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-14 text-base"
                />
              </div>
            )}

            <div className="space-y-3">
              <Label>Party size</Label>
              {isTableCheckIn && table && (
                <p className="text-xs text-muted-foreground">This table seats up to {table.capacity}.</p>
              )}
              <div className="flex items-center justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Decrease party size"
                  className="h-14 w-14 shrink-0 rounded-full active:scale-95"
                  onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <div className="min-w-0 text-center">
                  <div className="font-display text-5xl font-semibold leading-none">
                    {partySize}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    {partySize === 1 ? "guest" : "guests"}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Increase party size"
                  className="h-14 w-14 shrink-0 rounded-full active:scale-95"
                  onClick={() => setPartySize((n) => Math.min(12, n + 1))}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {oversized && (
            <div className="flex w-full items-start gap-3 rounded-xl border border-warning bg-warning/20 p-4 text-sm text-warning-foreground">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="min-w-0">
                {isTableCheckIn
                  ? "This table is too small for your party size. Please speak to the host to get seated at a larger table."
                  : "For parties larger than 8, please speak directly with our host stand."}
              </p>
            </div>
          )}
        </form>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <Button
            type="submit"
            form="checkin-form"
            disabled={loading || oversized || (isTableCheckIn && !table)}
            className="h-14 w-full text-base active:scale-95"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isTableCheckIn ? "Open Menu" : "Check In"}
          </Button>
        </div>
      </div>
    </main>
  );
}
