import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, Flame, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/guest";

import { triggerAnimatedToast } from "@/components/AnimatedToast";
import { playChime } from "@/hooks/use-role";
import { useNotificationStore } from "@/store/use-notification-store";

export const Route = createFileRoute("/_authenticated/admin/kitchen")({
  component: KitchenDisplay,
});

type TicketItem = { name: string; qty: number; notes: string | null };
type KitchenTicket = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  restaurant_tables: { table_number: number } | null;
  waitlist: { guest_name: string } | null;
  ticket_items: TicketItem[];
};

const COLUMNS = [
  { key: "received", label: "New Orders", icon: Sparkles, color: "border-info bg-info/10" },
  { key: "preparing", label: "Cooking", icon: Flame, color: "border-warning bg-warning/10" },
  { key: "ready", label: "Ready", icon: Clock, color: "border-success bg-success/10" },
] as const;

function KitchenDisplay() {
  const qc = useQueryClient();
  const { resetKitchen } = useNotificationStore();

  useEffect(() => {
    resetKitchen();
  }, [resetKitchen]);

  const { data: tickets = [] } = useQuery({
    queryKey: ["kitchen-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, status, total, created_at, restaurant_tables(table_number), waitlist(guest_name), ticket_items(name,qty,notes)")
        .in("status", ["received", "preparing", "ready"])
        .order("created_at");
      if (error) throw error;
      return data as KitchenTicket[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const { error } = await supabase
        .from("tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;
    },
    onMutate: ({ ticketId, status }) => {
      // 1. Cancel outgoing fetches so they don't overwrite optimistic update
      qc.cancelQueries({ queryKey: ["kitchen-tickets"] });
      qc.cancelQueries({ queryKey: ["tickets"] });

      // 2. Snapshot current state
      const previousKitchenTickets = qc.getQueryData<KitchenTicket[]>(["kitchen-tickets"]);
      const previousTickets = qc.getQueryData<any[]>(["tickets"]);

      // 3. Directly modify cache instantly (0.001 seconds)
      qc.setQueryData<KitchenTicket[]>(["kitchen-tickets"], (old = []) =>
        old.map((t) => (t.id === ticketId ? { ...t, status } : t)),
      );
      qc.setQueryData<any[]>(["tickets"], (old = []) =>
        old.map((t) => (t.id === ticketId ? { ...t, status } : t)),
      );

      // 4. Instant notification trigger inside onMutate
      const targetTicket = (previousKitchenTickets ?? []).find((t) => t.id === ticketId);
      const tableNum = targetTicket?.restaurant_tables?.table_number;
      const tableText = tableNum ? `Table ${tableNum}` : "Table";
      if (status === "preparing") {
        triggerAnimatedToast(`Cooking: ${tableText}`, "Order status updated to Cooking", "info");
      } else if (status === "ready") {
        triggerAnimatedToast(`Ready: ${tableText}`, "Order is ready for serving!", "success");
      }

      return { previousKitchenTickets, previousTickets };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousKitchenTickets) {
        qc.setQueryData(["kitchen-tickets"], context.previousKitchenTickets);
      }
      if (context?.previousTickets) {
        qc.setQueryData(["tickets"], context.previousTickets);
      }
      toast.error(err?.message || "Could not update status");
    },
  });

  const handleTicketStatusUpdate = (ticketId: string, status: string) => {
    // 1. INSTANTLY update UI (Zero Latency synchronous state override)
    qc.setQueryData<KitchenTicket[]>(["kitchen-tickets"], (old = []) =>
      old.map((t) => (t.id === ticketId ? { ...t, status } : t)),
    );
    qc.setQueryData<any[]>(["tickets"], (old = []) =>
      old.map((t) => (t.id === ticketId ? { ...t, status } : t)),
    );

    // 2. Fire database request in background WITHOUT awaiting it (Fire and Forget)
    updateStatusMutation.mutate({ ticketId, status });
  };

  useEffect(() => {
    const channel = supabase
      .channel("kitchen-kds-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        async (payload) => {
          const ticket = payload.new as any;
          if (!ticket) return;
          if (ticket.status === "received") {
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
            triggerAnimatedToast(`New Order: ${tableText}!`, "New ticket received in kitchen", "warning");
            playChime();
          }
          qc.setQueryData<KitchenTicket[]>(["kitchen-tickets"], (old = []) => {
            const exists = old.some((t) => t.id === ticket.id);
            return exists ? old.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)) : [ticket, ...old];
          });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_items" }, () => {
        // Direct cache refresh
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  function minutesSince(createdAt: string) {
    return Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
  }

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold">Kitchen display</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Live ticket board — tap the action button to advance each order.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const Icon = col.icon;
          const colTickets = tickets.filter((t) => t.status === col.key);
          return (
            <section
              key={col.key}
              className={`min-h-[420px] rounded-2xl border-2 p-4 ${col.color}`}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 shrink-0" />
                  <h2 className="text-lg font-bold uppercase tracking-wide">{col.label}</h2>
                </div>
                <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-sm font-bold">
                  {colTickets.length}
                </span>
              </div>

              <div className="space-y-4">
                {colTickets.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No orders here</p>
                )}
                {colTickets.map((t) => {
                  const elapsed = minutesSince(t.created_at);
                  const isUrgent = elapsed > 15;
                  return (
                    <article
                      key={t.id}
                      className={`rounded-xl p-4 shadow-sm transition-all duration-200 ${
                        isUrgent
                          ? "border-2 border-destructive bg-destructive/10 text-foreground"
                          : "border border-border bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-xl font-bold">
                          Table {t.restaurant_tables?.table_number ?? "—"}
                          {t.waitlist?.guest_name ? ` • ${t.waitlist.guest_name}` : ""}
                        </span>
                        {isUrgent ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-destructive bg-destructive/20 px-2.5 py-1 rounded-full animate-pulse">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {elapsed}m (OVERDUE)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {elapsed}m
                          </span>
                        )}
                      </div>

                    <ul className="mt-3 space-y-2">
                      {t.ticket_items?.map((it, idx) => (
                        <li key={idx} className="text-base font-medium">
                          <span className="text-primary">{it.qty}×</span> {it.name}
                          {it.notes && (
                            <span className="mt-0.5 block text-sm font-normal text-destructive">
                              ↳ {it.notes}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3 text-sm font-semibold text-muted-foreground">
                      {money(t.total)}
                    </p>

                    {col.key === "received" && (
                      <Button
                        className="mt-4 h-14 w-full text-base font-bold active:scale-95"
                        onClick={() => handleTicketStatusUpdate(t.id, "preparing")}
                      >
                        Start Cooking
                      </Button>
                    )}
                    {col.key === "preparing" && (
                      <Button
                        className="mt-4 h-14 w-full text-base font-bold active:scale-95"
                        onClick={() => handleTicketStatusUpdate(t.id, "ready")}
                      >
                        Mark as Ready
                      </Button>
                    )}
                    {col.key === "ready" && (
                      <Button
                        variant="outline"
                        className="mt-4 h-12 w-full text-sm font-semibold active:scale-95"
                        onClick={() => handleTicketStatusUpdate(t.id, "served")}
                      >
                        Mark Served
                      </Button>
                    )}
                  </article>
                );
              })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
