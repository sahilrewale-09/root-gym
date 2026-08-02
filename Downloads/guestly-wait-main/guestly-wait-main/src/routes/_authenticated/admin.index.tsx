import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/guest";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: LiveOps,
});

const TICKET_FLOW = ["received", "preparing", "ready", "served"];

function LiveOps() {
  const qc = useQueryClient();

  const { data: tables = [] } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .order("table_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ["waitlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .eq("status", "waiting")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, restaurant_tables(table_number), waitlist(guest_name), ticket_items(name,qty,notes)")
        .in("status", ["received", "preparing", "ready", "served"])
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-liveops-waitlist")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waitlist" },
        (payload) => {
          const item = payload.new as any;
          if (!item) return;

          if (payload.eventType === "INSERT") {
            if (item.status === "waiting") {
              qc.setQueryData<any[]>(["waitlist"], (old = []) => {
                if (old.some((w) => w.id === item.id)) return old;
                return [...old, item];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            if (item.status === "cancelled" || item.status === "seated" || item.status === "completed") {
              // Immediately slice out cancelled / seated guests from local React cache
              qc.setQueryData<any[]>(["waitlist"], (old = []) =>
                old.filter((w) => w.id !== item.id),
              );
            } else if (item.status === "waiting") {
              qc.setQueryData<any[]>(["waitlist"], (old = []) => {
                const idx = old.findIndex((w) => w.id === item.id);
                if (idx >= 0) {
                  const next = [...old];
                  next[idx] = { ...next[idx], ...item };
                  return next;
                }
                return [...old, item];
              });
            }
          } else if (payload.eventType === "DELETE") {
            const oldItem = payload.old as any;
            if (oldItem?.id) {
              qc.setQueryData<any[]>(["waitlist"], (old = []) =>
                old.filter((w) => w.id !== oldItem.id),
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  async function toggleTable(id: string, status: string) {
    const next = status === "available" ? "occupied" : "available";

    // 1. INSTANT UI Update (Zero Latency)
    qc.setQueryData<any[]>(["tables"], (old = []) =>
      old.map((t) => (t.id === id ? { ...t, status: next, seated_at: next === "occupied" ? new Date().toISOString() : null } : t)),
    );

    // 2. Fire & Forget background request
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ status: next, seated_at: next === "occupied" ? new Date().toISOString() : null })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["tables"] });
    }
  }

  async function seatNow(entryId: string, partySize: number) {
    const free = tables.find((t) => t.status === "available" && t.capacity >= partySize);
    if (!free) return toast.error("No free table large enough");

    const targetWaitlistEntry = waitlist.find((w: any) => w.id === entryId);
    const preOrderItems = ((targetWaitlistEntry as any)?.pre_order_cart as any[]) || [];

    // 1. INSTANT UI Update (Zero Latency)
    qc.setQueryData<any[]>(["tables"], (old = []) =>
      old.map((t) => (t.id === free.id ? { ...t, status: "occupied", seated_at: new Date().toISOString() } : t)),
    );
    qc.setQueryData<any[]>(["waitlist"], (old = []) =>
      old.filter((w) => w.id !== entryId),
    );

    if (preOrderItems.length > 0) {
      toast.success(`Table ${free.table_number} assigned. Pre-order sent directly to the Kitchen!`);
    } else {
      toast.success(`Seated at table ${free.table_number}`);
    }

    // 2. Background database requests
    try {
      await supabase
        .from("restaurant_tables")
        .update({ status: "occupied", seated_at: new Date().toISOString() })
        .eq("id", free.id);
      await supabase
        .from("waitlist")
        .update({ status: "notified", assigned_table: free.table_number, seated_at: new Date().toISOString() } as any)
        .eq("id", entryId);

      // Insta-Fire Kitchen Trigger if pre_order_cart has items
      if (preOrderItems.length > 0) {
        const { error: rpcErr } = await supabase.rpc("place_guest_order", {
          p_qr_token: free.qr_token,
          p_guest_token: targetWaitlistEntry?.guest_token || entryId,
          p_items: preOrderItems.map((item) => ({
            menu_item_id: item.menu_item_id || item.id,
            qty: item.qty || 1,
            notes: item.notes || null,
          })),
        });

        if (rpcErr) {
          // Fallback: manually create ticket if RPC fails
          const totalAmount = preOrderItems.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
          const { data: newTicket } = await supabase
            .from("tickets")
            .insert({
              table_id: free.id,
              table_number: free.table_number,
              status: "received",
              total: totalAmount,
              // link to guest via token or waitlist entry id
              guest_token: targetWaitlistEntry?.guest_token || entryId,
            } as any)
            .select("id")
            .single();

          if (newTicket?.id) {
            await supabase.from("ticket_items").insert(
              preOrderItems.map((i) => ({
                ticket_id: newTicket.id,
                menu_item_id: i.menu_item_id || i.id,
                name: i.name || "Item",
                qty: i.qty || 1,
                price: i.price || 0,
                notes: i.notes || null,
              })) as any,
            );
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update database");
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["waitlist"] });
    }
  }

  async function advance(ticket: any) {
    const next = TICKET_FLOW[Math.min(TICKET_FLOW.indexOf(ticket.status) + 1, 3)];
    const { error } = await supabase
      .from("tickets")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", ticket.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  const tableMap = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tables.map((t) => (
        <button
          key={t.id}
          onClick={() => toggleTable(t.id, t.status)}
          className={`touch-target rounded-2xl border p-4 text-left transition-transform active:scale-95 ${
            t.status === "available"
              ? "border-success bg-success/10"
              : "border-primary bg-primary/10"
          }`}
        >
          <p className="font-display text-2xl font-semibold">T{t.table_number}</p>
          <p className="text-xs text-muted-foreground">Seats {t.capacity}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide">{t.status}</p>
        </button>
      ))}
    </div>
  );

  const waitPanel = (
    <div className="space-y-3">
      {waitlist.length === 0 && <p className="text-sm text-muted-foreground">Nobody waiting.</p>}
      {waitlist.map((w, i) => (
        <div
          key={w.id}
          className="surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-4"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {i + 1}. {w.guest_name}
            </p>
            <p className="text-xs text-muted-foreground">
              Party of {w.party_size}
              {w.phone ? ` · ${w.phone}` : ""}
            </p>
          </div>
          <Button size="sm" className="shrink-0 active:scale-95" onClick={() => seatNow(w.id, w.party_size)}>
            Seat Now
          </Button>
        </div>
      ))}
    </div>
  );

  const kitchen = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {TICKET_FLOW.map((col) => (
        <div key={col} className="min-w-0 rounded-2xl bg-muted/50 p-3">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">{col}</h3>
          <div className="space-y-3">
            {tickets
              .filter((t) => t.status === col)
              .map((t) => (
                <div key={t.id} className="surface-card rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      Table {t.restaurant_tables?.table_number ?? "—"}
                      {t.waitlist?.guest_name ? ` (${t.waitlist.guest_name})` : ""}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {Math.max(
                        0,
                        Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000),
                      )}
                      m
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {t.ticket_items?.map((it: any, idx: number) => (
                      <li key={idx} className="min-w-0">
                        {it.qty}× {it.name}
                        {it.notes && (
                          <span className="block text-xs text-muted-foreground">{it.notes}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">{money(t.total)}</p>
                  {t.status !== "served" && (
                    <Button
                      size="sm"
                      className="mt-3 w-full active:scale-95"
                      onClick={() => advance(t)}
                    >
                      Mark {TICKET_FLOW[TICKET_FLOW.indexOf(t.status) + 1]}
                    </Button>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold">Live operations</h1>

      <div className="md:hidden">
        <Tabs defaultValue="tables" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
            <TabsTrigger value="kitchen">Kitchen</TabsTrigger>
          </TabsList>
          <TabsContent value="tables" className="mt-4">
            {tableMap}
          </TabsContent>
          <TabsContent value="waitlist" className="mt-4">
            {waitPanel}
          </TabsContent>
          <TabsContent value="kitchen" className="mt-4">
            {kitchen}
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden md:block">
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Table map</h2>
          {tableMap}
        </section>
        <div className="mt-8 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="min-w-0">
            <h2 className="mb-3 text-lg font-semibold">Waitlist</h2>
            {waitPanel}
          </section>
          <section className="min-w-0">
            <h2 className="mb-3 text-lg font-semibold">Kitchen tickets</h2>
            {kitchen}
          </section>
        </div>
      </div>
    </div>
  );
}
