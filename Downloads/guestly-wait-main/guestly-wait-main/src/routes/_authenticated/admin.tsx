import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Banknote,
  ChefHat,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  QrCode,
  RotateCcw,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AppRole, playChime, useRole } from "@/hooks/use-role";
import { triggerAnimatedToast } from "@/components/AnimatedToast";
import { notificationStore, useNotificationStore } from "@/store/use-notification-store";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminShell,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutGrid, allowedRoles: ["owner", "manager"] as const, exact: true },
  { to: "/admin/kitchen", label: "Kitchen", icon: ChefHat, allowedRoles: ["owner", "manager", "staff", "chef"] as const },
  { to: "/admin/billing", label: "Billing", icon: Banknote, allowedRoles: ["owner", "manager"] as const },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed, allowedRoles: ["owner", "manager"] as const },
  { to: "/admin/tables", label: "Tables & QR", icon: QrCode, allowedRoles: ["owner", "manager", "staff"] as const },
  { to: "/admin/sales", label: "Sales", icon: BarChart3, allowedRoles: ["owner", "manager"] as const },
  { to: "/admin/team", label: "Team", icon: UsersRound, allowedRoles: ["owner", "manager"] as const },
];

function getDefaultWorkspace(role: AppRole): string {
  switch (role) {
    case "chef":
      return "/admin/kitchen";
    case "staff":
      return "/admin/tables";
    case "manager":
    case "owner":
    default:
      return "/admin";
  }
}

function isRouteAllowed(role: AppRole, pathname: string): boolean {
  if (role === "owner" || role === "manager") return true;
  if (role === "chef") {
    return pathname === "/admin/kitchen" || pathname.startsWith("/admin/kitchen/");
  }
  if (role === "staff") {
    return (
      pathname === "/admin/tables" ||
      pathname.startsWith("/admin/tables/") ||
      pathname === "/admin/kitchen" ||
      pathname.startsWith("/admin/kitchen/")
    );
  }
  return false;
}

function AdminShell() {
  const [open, setOpen] = useState(false);
  const { role, email, loading } = useRole();
  const { unreadKitchen, unreadBilling } = useNotificationStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  const totalUnread = unreadKitchen + unreadBilling;
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ${restaurantName}`;
    } else {
      document.title = restaurantName;
    }
  }, [totalUnread, restaurantName]);

  useEffect(() => {
    if (loading || !role) return;
    if (!isRouteAllowed(role, location.pathname)) {
      const target = getDefaultWorkspace(role);
      if (location.pathname !== target) {
        navigate({ to: target, replace: true });
      }
    }
  }, [role, loading, location.pathname, navigate]);

  useEffect(() => {
    const playNotificationSound = () => {
      try {
        const ding = new Audio("/ding.mp3");
        ding.play().catch(() => playChime());
      } catch {
        playChime();
      }
    };

    const channel = supabase
      .channel("admin-layout-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "waitlist" },
        (payload) => {
          const guestName = payload.new?.guest_name || "Guest";
          toast.success(`New Waitlist Guest: ${guestName}`);
          playNotificationSound();
          queryClient.invalidateQueries({ queryKey: ["waitlist"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          const tableId = payload.new?.table_id || payload.new?.table_number || "";
          toast.success(`New Check-in at Table ${tableId}`);
          playNotificationSound();
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        async (payload) => {
          const ticket = payload.new as any;
          if (ticket) {
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
              playNotificationSound();

              if (window.location.pathname !== "/admin/kitchen") {
                notificationStore.incrementKitchen();
              }
            } else if (ticket.status === "payment_requested" || ticket.status === "payment_pending") {
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
              toast.info(`${tableText} is requesting the bill!`);

              if (window.location.pathname !== "/admin/billing") {
                notificationStore.incrementBilling();
              }
            }
          }
          if (ticket && ticket.id) {
            queryClient.setQueryData<any[]>(["tickets"], (old = []) => {
              const exists = old.some((t) => t.id === ticket.id);
              return exists ? old.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)) : [ticket, ...old];
            });
            queryClient.setQueryData<any[]>(["kitchen-tickets"], (old = []) => {
              const exists = old.some((t) => t.id === ticket.id);
              return exists ? old.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)) : [ticket, ...old];
            });
            queryClient.setQueryData<any[]>(["billing-tickets"], (old = []) => {
              const exists = old.some((t) => t.id === ticket.id);
              return exists ? old.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)) : [ticket, ...old];
            });
          }
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, () => {
        queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tables"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setupAutoKickListener() {
      const { data } = await supabase.auth.getUser();
      const currentUserId = data.user?.id;
      if (!currentUserId) return;

      channel = supabase
        .channel("profile-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${currentUserId}`,
          },
          async (payload) => {
            const newRecord = payload.new as any;
            if (!newRecord) return;

            // Task 2: Single Active Session Limit Check (Global Kill-Switch)
            const localSession = localStorage.getItem("active_session_id");
            const dbSession = newRecord.current_session_id;

            if (dbSession && localSession && dbSession !== localSession) {
              localStorage.removeItem("active_session_id");
              toast.error("Session Terminated: Your account was just accessed from another device.");
              await queryClient.cancelQueries();
              queryClient.clear();
              await supabase.auth.signOut();
              navigate({ to: "/admin-login", replace: true });
              return;
            }

            // Task 1 Fix: Only auto-kick if user is staff (owners & managers are exempt)
            if (newRecord.is_online === false && role === "staff") {
              localStorage.removeItem("active_session_id");
              toast.error("You have been forcefully logged out by an Admin.");
              await queryClient.cancelQueries();
              queryClient.clear();
              await supabase.auth.signOut();
              navigate({ to: "/admin-login", replace: true });
            }
          },
        )
        .subscribe();
    }

    if (!loading) {
      setupAutoKickListener();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [navigate, queryClient, role, loading]);

  async function signOut() {
    localStorage.removeItem("active_session_id");
    await (supabase.rpc as any)("toggle_online_status", { p_status: false });
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin-login", replace: true });
  }

  async function handleResetDemoData() {
    if (!window.confirm("Wipe all tickets, waitlists, and reset tables?")) {
      return;
    }
    try {
      const { error } = await supabase.rpc("reset_demo_data" as any);
      if (error) {
        toast.error(error.message || "Failed to reset demo data");
        return;
      }
      await queryClient.invalidateQueries();
      toast.success("Demo data reset successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset demo data");
    }
  }

  const links = NAV.filter((n) => role && (n.allowedRoles as readonly string[]).includes(role));

  const nav = (
    <nav className="flex flex-col gap-1">
      {links.map((n) => {
        const unreadCount =
          n.to === "/admin/kitchen"
            ? unreadKitchen
            : n.to === "/admin/billing"
              ? unreadBilling
              : 0;

        return (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.exact }}
            onClick={() => setOpen(false)}
            className="touch-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground"
          >
            <n.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{n.label}</span>
            {unreadCount > 0 && (
              <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                {unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col justify-between bg-sidebar p-4 md:flex">
        <div>
          <div className="mb-6 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 shrink-0 text-sidebar-primary" />
            <span className="font-display text-lg font-semibold text-sidebar-foreground">
              {restaurantName}
            </span>
          </div>
          {nav}
        </div>
        <div className="min-w-0 text-xs text-sidebar-foreground/70">
          <p className="truncate">{email}</p>
          <p className="uppercase tracking-widest">{role}</p>
          {isDemoMode && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-600 font-semibold"
              onClick={handleResetDemoData}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset Demo Data
            </Button>
          )}
          <Button variant="ghost" size="sm" className="mt-2 text-sidebar-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <Button
            variant="outline"
            size="icon"
            aria-label="Open navigation"
            className="h-11 w-11 shrink-0"
            onClick={() => setOpen(true)}
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <span className="truncate font-display text-lg font-semibold">{restaurantName}</span>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </header>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64 bg-sidebar p-4 flex flex-col justify-between">
            <div>
              <SheetTitle className="mb-4 text-sidebar-foreground">{restaurantName}</SheetTitle>
              {nav}
            </div>
            {isDemoMode && (
              <div className="pt-4 border-t border-sidebar-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-600 font-semibold"
                  onClick={handleResetDemoData}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset Demo Data
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <main className="min-w-0 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
