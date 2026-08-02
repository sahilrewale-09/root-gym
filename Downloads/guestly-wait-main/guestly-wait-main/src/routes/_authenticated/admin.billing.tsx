import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/guest";

import { triggerAnimatedToast } from "@/components/AnimatedToast";
import { useNotificationStore } from "@/store/use-notification-store";

export const Route = createFileRoute("/_authenticated/admin/billing")({
  component: BillingDashboard,
});

type BillingTicket = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  restaurant_tables: { table_number: number } | null;
  waitlist: { guest_name: string } | null;
  ticket_items: { name: string; qty: number }[];
};

function BillingDashboard() {
  const qc = useQueryClient();
  const { resetBilling } = useNotificationStore();

  useEffect(() => {
    resetBilling();
  }, [resetBilling]);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["billing-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, total, status, created_at, restaurant_tables(table_number), waitlist(guest_name), ticket_items(name,qty)")
        .in("status", ["payment_requested", "payment_pending", "served", "ready"])
        .order("created_at");
      if (error) throw error;
      return data as unknown as BillingTicket[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("billing-alerts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        async (payload) => {
          const ticket = payload.new as any;
          if (!ticket) return;

          if (ticket.status === "payment_requested" || ticket.status === "payment_pending") {
            let tableNum = ticket.table_number;
            if (!tableNum && ticket.table_id) {
              const { data } = await supabase
                .from("restaurant_tables")
                .select("table_number")
                .eq("id", ticket.table_id)
                .maybeSingle();
              if (data) tableNum = data.table_number;
            }
            const tableText = tableNum ? `Table ${tableNum}` : ticket.table_id ? `Table ${ticket.table_id}` : "Table 1";
            triggerAnimatedToast(`Payment Alert: ${tableText}!`, "Guest requested bill payment", "info");

            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
              gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.35);
            } catch (e) {
              // Audio context fallback
            }
          }

          qc.setQueryData<BillingTicket[]>(["billing-tickets"], (old = []) => {
            const exists = old.some((t) => t.id === ticket.id);
            return exists ? old.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)) : [ticket, ...old];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  async function clearTable(ticketId: string) {
    // 1. Snapshot previous cache for rollback
    const previousTickets = qc.getQueryData<BillingTicket[]>(["billing-tickets"]);

    // 2. Optimistically remove from UI cache (Zero-Latency)
    qc.setQueryData(["billing-tickets"], (old: BillingTicket[] | undefined) =>
      old ? old.filter((t) => t.id !== ticketId) : [],
    );

    try {
      // 3. Mark the ticket as completed via standard Supabase update
      const { error } = await supabase
        .from("tickets")
        .update({ status: "completed", updated_at: new Date().toISOString() } as any)
        .eq("id", ticketId);

      if (error) {
        toast.error("DB Error: " + error.message);
        throw new Error(error.message);
      }

      // 4. Free up the associated table
      const ticket = previousTickets?.find((t) => t.id === ticketId);
      if (ticket) {
        // Get table_id from the ticket to free it
        const { data: ticketRow } = await (supabase.from("tickets") as any)
          .select("table_id")
          .eq("id", ticketId)
          .maybeSingle();

        if (ticketRow?.table_id) {
          await supabase
            .from("restaurant_tables")
            .update({ status: "available", seated_at: null } as any)
            .eq("id", ticketRow.table_id);
        }
      }

      toast.success("Payment confirmed and table closed!");
    } catch (err: any) {
      // 5. Rollback optimistic update on failure
      if (previousTickets) {
        qc.setQueryData(["billing-tickets"], previousTickets);
      }
      toast.error("Failed to clear bill: " + (err?.message || "Unknown error"));
      console.error("clearTable error:", err);
    }
  }

  const pendingPayments = tickets.filter(
    (t) => t.status === "payment_requested" || t.status === "payment_pending",
  );
  const activeDining = tickets.filter(
    (t) => t.status !== "payment_requested" && t.status !== "payment_pending",
  );

  return (
    <div className="min-w-0 pb-12">
      <div className="flex items-center gap-2">
        <Banknote className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Billing &amp; settlement</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Confirm UPI or cash payments and free up tables instantly.
      </p>

      {isLoading ? (
        <div className="mt-16 flex justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="surface-card mt-8 rounded-2xl p-10 text-center border border-border">
          <p className="text-muted-foreground">No pending payments or active tickets right now.</p>
        </div>
      ) : (
        <>
          {/* PENDING PAYMENTS SECTION */}
          {pendingPayments.length > 0 && (
            <section className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <h2 className="text-base font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  Pending Payment Requests ({pendingPayments.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {pendingPayments.map((t) => (
                  <article
                    key={t.id}
                    className="surface-card rounded-2xl p-6 border-2 border-amber-500/80 bg-amber-500/10 dark:bg-amber-950/30 shadow-xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-2 border-b border-amber-500/30 pb-3">
                        <span className="font-display text-2xl font-extrabold tracking-tight">
                          Table {t.restaurant_tables?.table_number ?? "—"}
                          {t.waitlist?.guest_name ? ` • ${t.waitlist.guest_name}` : ""}
                        </span>
                        <span className="font-display text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                          {money(t.total)}
                        </span>
                      </div>

                      <div className="mt-3 rounded-xl bg-amber-500/20 dark:bg-amber-900/40 p-3 border border-amber-500/40 text-center">
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                          Cash Collection Required: {money(t.total)}
                        </p>
                      </div>

                      <ul className="mt-4 space-y-1.5 text-sm font-medium text-foreground/80">
                        {t.ticket_items?.map((it, idx) => (
                          <li key={idx} className="flex items-center justify-between">
                            <span>{it.name}</span>
                            <span className="font-bold text-muted-foreground">×{it.qty}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      size="lg"
                      className="mt-6 h-16 w-full text-base font-bold shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all"
                      onClick={() => clearTable(t.id)}
                    >
                      Confirm Cash &amp; Close Table
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* OTHER ACTIVE DINING TABLES */}
          {activeDining.length > 0 && (
            <section className="mt-10">
              <h2 className="text-base font-bold text-muted-foreground uppercase tracking-wide mb-3">
                Active Dining Tables ({activeDining.length})
              </h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {activeDining.map((t) => (
                  <article
                    key={t.id}
                    className="surface-card rounded-2xl p-6 border-2 border-border shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-2 border-b border-border/80 pb-3">
                        <span className="font-display text-2xl font-extrabold tracking-tight">
                          Table {t.restaurant_tables?.table_number ?? "—"}
                          {t.waitlist?.guest_name ? ` • ${t.waitlist.guest_name}` : ""}
                        </span>
                        <span className="font-display text-2xl font-bold text-primary">
                          {money(t.total)}
                        </span>
                      </div>

                      <ul className="mt-4 space-y-1.5 text-sm font-medium text-foreground/80">
                        {t.ticket_items?.map((it, idx) => (
                          <li key={idx} className="flex items-center justify-between">
                            <span>{it.name}</span>
                            <span className="font-bold text-muted-foreground">×{it.qty}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      size="lg"
                      variant="outline"
                      className="mt-6 h-16 w-full text-base font-bold active:scale-95 transition-all"
                      onClick={() => clearTable(t.id)}
                    >
                      Confirm Payment &amp; Clear Table
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
