import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/guest";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: Analytics,
});

function Analytics() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const [tickets, seated] = await Promise.all([
        supabase.from("tickets").select("total,created_at").gte("created_at", since.toISOString()),
        supabase
          .from("waitlist")
          .select("created_at,seated_at,status")
          .gte("created_at", since.toISOString()),
      ]);
      const rows = tickets.data ?? [];
      const guests = seated.data ?? [];
      const waits = guests
        .filter((g) => g.seated_at)
        .map((g) => (new Date(g.seated_at!).getTime() - new Date(g.created_at).getTime()) / 60000);
      return {
        revenue: rows.reduce((n, r) => n + Number(r.total), 0),
        orders: rows.length,
        avgWait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
        turnover: guests.filter((g) => g.status === "completed").length,
      };
    },
  });

  const cards = [
    { label: "Revenue today", value: money(data?.revenue ?? 0) },
    { label: "Total orders", value: String(data?.orders ?? 0) },
    { label: "Average wait", value: `${Math.round(data?.avgWait ?? 0)} min` },
    { label: "Tables turned", value: String(data?.turnover ?? 0) },
  ];

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="surface-card rounded-2xl p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
