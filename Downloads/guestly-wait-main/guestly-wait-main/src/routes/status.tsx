import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UtensilsCrossed, Clock, QrCode } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CART_KEY, clearGuestSession, clearGuestToken, readGuestToken } from "@/lib/guest";

export const Route = createFileRoute("/status")({
  head: () => {
    const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";
    return {
      meta: [
        { title: `Your Table Status — ${restaurantName}` },
        { name: "description", content: `Live waitlist position and table assignment for your ${restaurantName} visit.` },
        { property: "og:title", content: `Your Table Status — ${restaurantName}` },
        { property: "og:description", content: "Live waitlist position and table assignment for your visit." },
      ],
    };
  },
  component: StatusPage,
});

type GuestStatus = {
  guest_token: string;
  guest_name: string;
  party_size: number;
  status: "waiting" | "seated" | "completed";
  position: number | null;
  estimated_wait: number;
  table_number: number | null;
  qr_token: string | null;
};

function StatusPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    const t = readGuestToken();
    if (!t) navigate({ to: "/checkin", search: { t: "" } });
    setToken(t);
  }, [navigate]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["guest-status", token],
    enabled: !!token,
    refetchInterval: 8000,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_guest_status", { p_token: token! });
        if (error) throw error;
        return data as unknown as GuestStatus | null;
      } catch (err) {
        console.error("get_guest_status query error:", err);
        return null;
      }
    },
  });

  // Retrieve stored table ID for active order
  const storedTableId = typeof window !== "undefined" ? localStorage.getItem('table_id') : null;

  // Fetch active ticket for this table (if any)
  const { data: activeTicket, isLoading: loadingTicket } = useQuery({
    queryKey: ["active-ticket", storedTableId],
    enabled: !!storedTableId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, ticket_items!inner(name, qty, notes)")
        .eq("table_id", storedTableId as any)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!token) return;
    const channel = supabase
      .channel("guest-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [token, refetch]);

  useEffect(() => {
    if (isLoading) return;

    if (!data || data.status === "completed") {
      clearGuestToken();
      clearGuestSession();
      localStorage.removeItem("guest_token");
      localStorage.removeItem("tablepe_guest_token");
      localStorage.removeItem(CART_KEY);
      navigate({ to: "/", replace: true });
    } else if (data.status === "seated") {
    // Stay on the status page to show active ticket progress
    // No navigation; UI will render ticket info based on stored table_id
  }  
  }, [data, isLoading, navigate]);

  async function freeTable() {
    if (!token) return;
    setReleasing(true);
    const { error } = await supabase.rpc("free_up_table", { p_token: token });
    setReleasing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    clearGuestToken();
    toast.success("Thanks for dining with us!");
    navigate({ to: "/" });
  }

  const { data: waitlistEntry } = useQuery({
    queryKey: ["waitlist-entry-by-token", token],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await supabase
        .from("waitlist")
        .select("id, pre_order_cart")
        .or(`guest_token.eq.${token},id.eq.${token}`)
        .maybeSingle();
      return data as { id: string; pre_order_cart?: any[] } | null;
    },
  });

  const [cancelled, setCancelled] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function handleLeaveLine() {
    const confirmed = window.confirm("Are you sure you want to leave the waitlist?");
    if (!confirmed) return;

    setLeaving(true);
    const targetWaitlistId = waitlistEntry?.id || (data as any)?.id || localStorage.getItem("active_waitlist_id") || token;

    try {
      if (targetWaitlistId) {
        await supabase
          .from("waitlist")
          .update({ status: "cancelled" } as any)
          .eq("id", targetWaitlistId);
      }

      clearGuestToken();
      clearGuestSession();
      localStorage.removeItem("active_waitlist_id");
      localStorage.removeItem("guest_token");
      localStorage.removeItem("tablepe_guest_token");
      localStorage.removeItem(CART_KEY);

      setCancelled(true);
      toast.success("You have left the queue.");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message || "Could not cancel waitlist spot");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background pb-28">
      <div className="mx-auto w-full max-w-md px-5 pt-10">
        <div className="flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-5 w-5 shrink-0" />
          <span className="font-display text-xl font-semibold text-foreground">{import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant"}</span>
        </div>

        {isLoading || !data ? (
          <div className="mt-24 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Checking your place…</p>
          </div>
        ) : cancelled || (data as any).status === "cancelled" ? (
          <section className="mt-16 text-center">
            <div className="surface-card mx-auto max-w-sm rounded-3xl p-8 shadow-lifted">
              <h1 className="font-display text-2xl font-bold text-foreground">
                Waitlist Cancelled
              </h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                You have been removed from the waitlist. We hope to see you another time!
              </p>
              <Button
                onClick={() => {
                  clearGuestToken();
                  clearGuestSession();
                  localStorage.removeItem("guest_token");
                  localStorage.removeItem("tablepe_guest_token");
                  localStorage.removeItem(CART_KEY);
                  navigate({ to: "/checkin", search: { t: "" } });
                }}
                variant="default"
                className="mt-8 h-14 w-full text-base font-semibold active:scale-95"
              >
                Start a new check-in
              </Button>
            </div>
          </section>
        ) : data.status === "seated" ? (
          <section className="mt-10 text-center">
            <span className="inline-flex items-center rounded-full bg-primary px-5 py-2 font-display text-lg font-semibold text-primary-foreground">
              Table {data.table_number}
            </span>
            <h1 className="mt-6 text-5xl font-semibold leading-tight">You're Seated</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {data.guest_name}, party of {data.party_size}. Your server will be right over.
            </p>
            <div className="surface-card mx-auto mt-8 overflow-hidden rounded-2xl text-left">
              <div className="bg-primary/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <p className="font-display text-sm font-semibold text-foreground">
                    Scan to order
                  </p>
                </div>
              </div>
              <p className="px-5 py-5 text-sm leading-relaxed text-foreground">
                You're seated at Table {data.table_number}! Please open your phone's native camera
                and scan the QR code on your table stand to view the menu and place your order.
              </p>

{/* Active Ticket Status */}
{activeTicket && (
  <div className="mt-6 surface-card p-4 rounded-xl bg-muted/20">
    <h3 className="font-display text-lg font-semibold mb-2">Order Status: {activeTicket.status}</h3>
    <ul className="list-disc list-inside space-y-1 text-sm">
      {activeTicket.ticket_items?.map((it: any, idx: number) => (
        <li key={idx}>{it.qty}× {it.name}{it.notes && ` (${it.notes})`}</li>
      ))}
    </ul>
    <p className="mt-2 text-sm text-muted-foreground">Total: ${activeTicket.total?.toFixed(2) || '0.00'}</p>
  </div>
)}

            </div>
          </section>
        ) : data.status === "completed" ? (
          <section className="mt-16 text-center">
            <h1 className="text-4xl font-semibold">Visit complete</h1>
            <p className="mt-3 text-sm text-muted-foreground">Grazie, see you again soon.</p>
            <Button asChild variant="outline" className="mt-8 h-14 w-full text-base">
              <Link to="/checkin" search={{ t: "" }}>Start a new check-in</Link>
            </Button>
          </section>
        ) : (
          <section className="mt-10 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-accent" />
              Live status
            </div>
            <h1 className="mt-6 font-display text-7xl font-semibold leading-none text-primary">
              {data.position}
            </h1>
            <p className="mt-2 text-lg font-medium">in line</p>
            <div className="surface-card mx-auto mt-8 flex items-center justify-center gap-3 rounded-2xl p-5">
              <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="text-xl font-semibold">~{data.estimated_wait} min</span>
              <span className="text-sm text-muted-foreground">estimated wait</span>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              {data.guest_name}, party of {data.party_size}. Keep this page open — it updates
              itself.
            </p>

            <Button
              onClick={() =>
                navigate({
                  to: "/menu",
                  search: { t: "", waitlistId: waitlistEntry?.id || (data as any)?.id || token || "" },
                })
              }
              className="mt-6 h-14 w-full text-base font-bold shadow-lg active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <UtensilsCrossed className="h-5 w-5 shrink-0" />
              {waitlistEntry?.pre_order_cart && (waitlistEntry.pre_order_cart as any[]).length > 0
                ? "Edit Pre-Order"
                : "Browse Menu & Pre-Order"}
            </Button>

            <Button
              variant="outline"
              onClick={handleLeaveLine}
              disabled={leaving}
              className="mt-4 h-12 w-full text-sm font-semibold border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 active:scale-95 shadow-sm"
            >
              {leaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Leave Queue
            </Button>
          </section>
        )}
      </div>

      {data?.status === "seated" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur">
          <div className="mx-auto w-full max-w-md">
            <Button
              variant="outline"
              onClick={freeTable}
              disabled={releasing}
              className="h-12 w-full active:scale-95"
            >
              {releasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Free Up Table
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
