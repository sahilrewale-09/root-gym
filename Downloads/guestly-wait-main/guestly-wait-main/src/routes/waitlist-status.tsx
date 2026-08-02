import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, ShoppingBag, Sparkles, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CART_KEY, clearGuestSession, clearGuestToken, readGuestToken } from "@/lib/guest";

export const Route = createFileRoute("/waitlist-status")({
  head: () => {
    const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";
    return {
      meta: [
        { title: `Your Waitlist Status — ${restaurantName}` },
        { name: "description", content: `Live waitlist position for your ${restaurantName} visit.` },
      ],
    };
  },
  component: WaitlistStatusPage,
});

function WaitlistStatusPage() {
  const navigate = useNavigate();

  const [waitlistId, setWaitlistId] = useState<string | null>(null);
  const [tableReady, setTableReady] = useState<{ assigned_table: number | null } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  // ── On mount: read waitlistId from localStorage ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem("active_waitlist_id");
    if (!id) {
      navigate({ to: "/join-waitlist", replace: true });
      return;
    }
    setWaitlistId(id);
  }, [navigate]);

  // ── Fetch all waiting entries to compute position ──
  const { data: waitingList = [], isLoading } = useQuery({
    queryKey: ["waitlist-waiting", waitlistId],
    enabled: !!waitlistId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await (supabase.from("waitlist") as any)
        .select("*")
        .eq("status", "waiting")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // ── Fetch this guest's own row ──
  const { data: myEntry } = useQuery({
    queryKey: ["waitlist-mine", waitlistId],
    enabled: !!waitlistId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await (supabase.from("waitlist") as any)
        .select("*")
        .eq("id", waitlistId!)
        .maybeSingle();
      if (error) throw error;
      return data as any | null;
    },
  });

  // ── Real-time listener for this guest's row ──
  useEffect(() => {
    if (!waitlistId) return;

    const channel = supabase
      .channel(`waitlist-status-${waitlistId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "waitlist",
          filter: `id=eq.${waitlistId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (!updated) return;

          if (updated.status === "notified" || updated.status === "seated") {
            setTableReady({ assigned_table: updated.assigned_table ?? null });
          }
          if (updated.status === "cancelled") {
            setCancelled(true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [waitlistId]);

  // ── Check if already notified on mount ──
  useEffect(() => {
    if (!myEntry) return;
    if (myEntry.status === "notified" || myEntry.status === "seated") {
      setTableReady({ assigned_table: myEntry.assigned_table ?? null });
    }
    if (myEntry.status === "cancelled") {
      setCancelled(true);
    }
  }, [myEntry]);

  // ── Position calculation ──
  const position = waitlistId
    ? waitingList.findIndex((e: any) => e.id === waitlistId) + 1
    : 0;
  const estimatedWait = position > 0 ? position * 5 : 0;

  // ── Leave Queue handler ──
  async function handleLeaveQueue() {
    const confirmed = window.confirm("Are you sure you want to leave the waitlist?");
    if (!confirmed) return;

    setLeaving(true);
    try {
      if (waitlistId) {
        await supabase
          .from("waitlist")
          .update({ status: "cancelled" } as any)
          .eq("id", waitlistId);
      }
      clearGuestToken();
      clearGuestSession();
      localStorage.removeItem("active_waitlist_id");
      localStorage.removeItem("guest_token");
      localStorage.removeItem("tablepe_guest_token");
      localStorage.removeItem(CART_KEY);
      toast.success("You have left the queue.");
      navigate({ to: "/", replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Could not leave the queue");
    } finally {
      setLeaving(false);
    }
  }

  // ── Sit down / Dismiss table-ready modal ──
  function handleSitDown() {
    const tableId = tableReady?.assigned_table;
    if (tableId != null) {
      // 1. Save the new table session
      localStorage.setItem("active_table_id", tableId.toString());
      localStorage.setItem("table_id", tableId.toString());
    }
    // 2. Clear the old waitlist session
    localStorage.removeItem("active_waitlist_id");
    setTableReady(null);

    // 3. Navigate to the menu route WITH the table context
    navigate({
      to: "/menu",
      search: { t: String(tableId ?? ""), waitlistId: "" },
      replace: true,
    });
  }

  // ── Pre-order cart items ──
  const preOrderCart: any[] = myEntry?.pre_order_cart && Array.isArray(myEntry.pre_order_cart)
    ? myEntry.pre_order_cart
    : [];
  const hasPreOrder = preOrderCart.length > 0;

  // ── RENDER ──

  if (isLoading && !myEntry) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background pb-28">
      <div className="mx-auto w-full max-w-md px-5 pt-10">
        <div className="flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-5 w-5 shrink-0" />
          <span className="font-display text-xl font-semibold text-foreground">{import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant"}</span>
        </div>

        {/* ── Table Ready Full-Screen Modal ── */}
        {tableReady && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 p-6 backdrop-blur-md text-white text-center animate-in fade-in duration-200">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 text-white shadow-2xl animate-bounce">
              <Sparkles className="h-10 w-10" />
            </div>
            <h2 className="mt-6 font-display text-4xl font-extrabold tracking-tight">
              Your Table is Ready! 🎉
            </h2>
            <p className="mt-4 text-xl font-medium text-emerald-300">
              Please head over to{" "}
              <strong className="text-white underline underline-offset-4 font-bold text-2xl">
                Table {tableReady.assigned_table ?? "—"}
              </strong>
              .
            </p>
            <p className="mt-2 text-sm text-gray-300">
              Our team is waiting to welcome you and start serving your meal.
            </p>
            <Button
              onClick={handleSitDown}
              className="mt-8 h-14 w-full max-w-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-xl active:scale-95 rounded-2xl"
            >
              I'm sitting down (View Menu)
            </Button>
          </div>
        )}

        {/* ── Cancelled Screen ── */}
        {cancelled ? (
          <section className="mt-10 text-center">
            <h1 className="text-3xl font-semibold leading-tight">You've Left the Queue</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              We hope to see you another time!
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-8 h-14 w-full text-base"
            >
              <a href="/checkin?t=">Start a new check-in</a>
            </Button>
          </section>
        ) : (
          <section className="mt-10 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-accent" />
              Live status
            </div>

            <h1 className="mt-6 font-display text-7xl font-semibold leading-none text-primary">
              {position > 0 ? `#${position}` : "—"}
            </h1>
            <p className="mt-2 text-lg font-medium">in line</p>

            <div className="surface-card mx-auto mt-8 flex items-center justify-center gap-3 rounded-2xl p-5">
              <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="text-xl font-semibold">~{estimatedWait} min</span>
              <span className="text-sm text-muted-foreground">estimated wait</span>
            </div>

            {myEntry && (
              <p className="mt-6 text-sm text-muted-foreground">
                {myEntry.guest_name}, party of {myEntry.party_size}. Keep this page open — it
                updates itself.
              </p>
            )}

            {/* ── Pre-Order Summary ── */}
            {hasPreOrder && (
              <div className="surface-card mt-6 rounded-2xl border border-border p-5 text-left">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-wide">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Your Pre-Order
                </div>
                <ul className="mt-3 space-y-2">
                  {preOrderCart.map((item: any, idx: number) => (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{item.name || "Item"}</span>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                        ×{item.qty || 1}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  We'll start cooking the moment your table is ready.
                </p>
              </div>
            )}

            {/* Browse Menu & Pre-Order */}
            <Button
              onClick={() =>
                navigate({
                  to: "/menu",
                  search: { t: "", waitlistId: waitlistId || "" },
                })
              }
              className="mt-6 h-14 w-full text-base font-bold shadow-lg active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <UtensilsCrossed className="h-5 w-5 shrink-0" />
              {hasPreOrder ? "Edit Pre-Order" : "Browse Menu & Pre-Order"}
            </Button>

            {/* Leave Queue */}
            <Button
              variant="outline"
              onClick={handleLeaveQueue}
              disabled={leaving}
              className="mt-4 h-12 w-full text-sm font-semibold border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 active:scale-95 shadow-sm"
            >
              {leaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Leave Queue
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}
