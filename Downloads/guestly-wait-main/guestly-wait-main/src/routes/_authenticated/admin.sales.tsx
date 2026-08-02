import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IndianRupee, RefreshCw, ShoppingBag, Trophy, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/guest";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  component: SalesDashboard,
});

type TopItem = {
  name: string;
  total_sold: number;
};

type SalesMetrics = {
  daily_revenue: number;
  total_orders: number;
  top_items: TopItem[];
};

function SalesDashboard() {
  const queryClient = useQueryClient();

  const { data: metrics, isLoading, isFetching } = useQuery<SalesMetrics>({
    queryKey: ["sales_metrics", "today"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_sales_dashboard_metrics" as any);
        if (!error && data) return data as unknown as SalesMetrics;
      } catch (err) {
        console.warn("get_sales_dashboard_metrics RPC fallback:", err);
      }

      // Robust fallback calculation from tickets table if RPC is not present
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: ticketsData } = await supabase
        .from("tickets")
        .select("id, total, ticket_items(name, qty)")
        .gte("created_at", today.toISOString());

      const rows = ticketsData ?? [];
      const daily_revenue = rows.reduce((sum, r) => sum + Number(r.total || 0), 0);
      const total_orders = rows.length;

      const itemMap: Record<string, number> = {};
      rows.forEach((t: any) => {
        (t.ticket_items || []).forEach((item: any) => {
          const name = item.name || "Unknown Item";
          itemMap[name] = (itemMap[name] || 0) + Number(item.qty || 1);
        });
      });

      const top_items = Object.entries(itemMap)
        .map(([name, total_sold]) => ({ name, total_sold }))
        .sort((a, b) => b.total_sold - a.total_sold);

      return { daily_revenue, total_orders, top_items };
    },
  });

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["sales_metrics"] });
    toast.success("Sales metrics refreshed!");
  };

  const revenue = metrics?.daily_revenue ?? 0;
  const orders = metrics?.total_orders ?? 0;
  const topItems = metrics?.top_items ?? [];

  return (
    <div className="min-w-0 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time revenue metrics, order totals, and product leaderboard.</p>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={isFetching}
          variant="outline"
          className="flex items-center gap-2 font-semibold shadow-sm active:scale-95 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Today's Revenue Card (Premium Aesthetic) */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background p-6 shadow-soft transition-all duration-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Today's Revenue
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 font-display text-4xl font-extrabold text-foreground tracking-tight">
            {money(revenue)}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
            <span>Updated live from today's tickets</span>
          </div>
        </div>

        {/* Total Completed Orders Card */}
        <div className="surface-card rounded-3xl p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Total Completed Orders
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 font-display text-4xl font-extrabold text-foreground tracking-tight">
            {orders}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Orders processed today
          </p>
        </div>
      </div>

      {/* Top Selling Items Leaderboard */}
      <div className="surface-card rounded-3xl p-6 shadow-soft">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-display text-xl font-bold text-foreground">Top Selling Items</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 w-full bg-muted/60 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : topItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No sales recorded yet today.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {topItems.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground">
                    {index === 0 ? "🏆" : `#${index + 1}`}
                  </div>
                  <span className={`text-base font-semibold ${index === 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {item.total_sold} sold
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
