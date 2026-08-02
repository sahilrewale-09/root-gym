import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Check,
  CheckCircle2,
  Loader2,
  PartyPopper,
  PlusCircle,
  RotateCw,
  Smartphone,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CART_KEY, clearGuestSession, money, readQrToken } from "@/lib/guest";
import { triggerAnimatedToast } from "@/components/AnimatedToast";

export const Route = createFileRoute("/order/$ticketId")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : "",
  }),
  head: () => ({
    meta: [
      { title: "Order Tracker — Tablepe" },
      { name: "description", content: "Follow your Tablepe order from the kitchen to your table in real time." },
      { property: "og:title", content: "Order Tracker — Tablepe" },
      { property: "og:description", content: "Follow your order from the kitchen to your table in real time." },
    ],
  }),
  component: OrderTracker,
});

const STEPS = ["received", "cooking", "ready", "served"] as const;
const LABELS: Record<string, string> = {
  received: "Received",
  cooking: "Cooking",
  ready: "Ready",
  served: "Served",
  payment_requested: "Bill requested",
  payment_pending: "Payment pending",
  completed: "Complete",
};

const TOAST_STATUSES = new Set(["cooking", "ready"]);

type RestaurantSettings = {
  merchant_upi_id: string | null;
  merchant_name: string | null;
};

type TicketPayload = {
  id: string;
  status: string;
  total: number;
  table_number: number | null;
  qr_token: string | null;
  guest_name: string | null;
  items: { name: string; qty: number; price: number; notes: string | null }[];
};

function OrderTracker() {
  const { ticketId } = Route.useParams();
  const { t: qrFromSearch } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [showConfirmScreen, setShowConfirmScreen] = useState(false);
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleEndSession() {
    localStorage.removeItem("guest_token");
    localStorage.removeItem("tablepe_guest_token");
    localStorage.removeItem(CART_KEY);
    clearGuestSession();
    navigate({ to: "/thank-you", replace: true });
  }

  const [data, setData] = useState<TicketPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTicket = async () => {
    try {
      const [ticketRes, settingsRes] = await Promise.all([
        supabase.rpc("get_ticket_public", { p_ticket_id: ticketId }),
        supabase
          .from("restaurant_settings" as any)
          .select("merchant_upi_id, merchant_name")
          .eq("id", 1)
          .maybeSingle(),
      ]);

      if (ticketRes.error) {
        console.error("get_ticket_public error:", ticketRes.error);
        setData(null);
      } else {
        setData(ticketRes.data as unknown as TicketPayload | null);
      }

      if (settingsRes.data) {
        setRestaurantSettings(settingsRes.data as unknown as RestaurantSettings);
      }
    } catch (err) {
      console.error("get_ticket_public catch error:", err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchTicket();
    setIsRefreshing(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchTicket();
    const interval = setInterval(fetchTicket, 15000);
    return () => clearInterval(interval);
  }, [ticketId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchTicket();
      }
    };

    const handleFocus = () => {
      void fetchTicket();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [ticketId]);

  useEffect(() => {
    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` },
        (payload) => {
          const newStatus = (payload.new as any)?.status as string | undefined;
          if (!newStatus) return;

          if (newStatus === "cooking" || newStatus === "preparing") {
            triggerAnimatedToast("Chef started cooking your order!", "Your meal is being prepared with care.", "info");
          } else if (newStatus === "ready") {
            triggerAnimatedToast("Your food is ready to be served!", "Fresh & hot out of the kitchen.", "success");
          }

          if (newStatus === "completed" || newStatus === "done") {
            localStorage.removeItem("guest_token");
            localStorage.removeItem("tablepe_guest_token");
            clearGuestSession();
            toast.success("Payment confirmed. Thank you!");
            navigate({ to: "/thank-you", replace: true });
            return;
          }

          setData((current) => {
            if (!current || current.status === newStatus) return current;

            if (TOAST_STATUSES.has(newStatus)) {
              const label = LABELS[newStatus] ?? newStatus;
              toast.success(`Good news! Your order is now ${label}.`);
            }
            if (newStatus === "served") {
              toast.success("Your food has been served!");
            }
            if (newStatus === "payment_requested" || newStatus === "payment_pending") {
              toast.success("Bill request received. A waiter will be with you shortly.");
            }

            return { ...current, status: newStatus };
          });

          // Inject directly into query cache (bypassing HTTP fetch)
          queryClient.setQueryData(["ticket", ticketId], (oldData: any) =>
            oldData ? { ...oldData, status: newStatus } : oldData,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, navigate]);

  const isServed = data?.status === "served";
  const isPaymentRequested =
    data?.status === "payment_requested" || data?.status === "payment_pending";
  const isCompleted = data?.status === "completed" || data?.status === "done";
  const showBill = isServed || isPaymentRequested || isCompleted;

  const rawStatus = data?.status ?? "received";
  const normalizedStatus = rawStatus === "preparing" ? "cooking" : rawStatus;
  const stepIndex = STEPS.indexOf(normalizedStatus as (typeof STEPS)[number]);
  const currentIndex =
    isServed || isPaymentRequested || isCompleted ? STEPS.length - 1 : Math.max(stepIndex, 0);
  const qrToken = data?.qr_token ?? qrFromSearch ?? readQrToken() ?? "";

  const subtotal = data?.items ? data.items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0) : Number(data?.total ?? 0);
  const gst = subtotal * 0.05;
  const totalAmount = subtotal + gst;

  function handleOrderMore() {
    navigate({ to: "/menu", search: { t: qrToken ?? "", waitlistId: "" } });
  }

  function handlePayCash() {
    if (!data) return;

    // 1. INSTANTLY update UI (Zero Latency - Fire & Forget)
    setData((current) => (current ? { ...current, status: "payment_requested" } : current));
    queryClient.setQueryData(["ticket", ticketId], (old: any) =>
      old ? { ...old, status: "payment_requested" } : old,
    );
    toast.success("Waiter notified. Please keep cash ready.");

    // 2. Fire database request in background WITHOUT awaiting it
    supabase.rpc("request_ticket_payment", { p_ticket_id: ticketId }).then(({ error }) => {
      if (error) {
        toast.error(error.message || "Could not request payment");
      }
    });
  }

  function handleUPIPayment() {
    if (!data) return;
    const upiId = restaurantSettings?.merchant_upi_id || "restaurant@upi";
    const upiName = restaurantSettings?.merchant_name || "Tablepe Restaurant";
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(`Table_${data.table_number ?? "X"}_Order_${ticketId}`)}`;

    window.location.href = upiLink;
    setShowConfirmScreen(true);
  }

  function handleConfirmPaymentSent() {
    if (!data) return;

    // 1. INSTANTLY update UI (Zero Latency - Fire & Forget)
    setData((current) => (current ? { ...current, status: "payment_requested" } : current));
    queryClient.setQueryData(["ticket", ticketId], (old: any) =>
      old ? { ...old, status: "payment_requested" } : old,
    );
    setShowConfirmScreen(false);
    toast.success("Payment request sent to cashier for confirmation!");

    // 2. Fire database request in background WITHOUT awaiting it
    supabase.rpc("request_ticket_payment", { p_ticket_id: ticketId }).then(({ error }) => {
      if (error) {
        toast.error(error.message || "Failed to notify cashier");
      }
    });
  }

  function handleCancelConfirm() {
    setShowConfirmScreen(false);
  }

  function BillSummary() {
    if (!data) return null;
    return (
      <div className="surface-card mt-8 rounded-2xl p-5 text-left w-full">
        <h2 className="text-base font-semibold">Final Bill Summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.items.map((it, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                {it.qty}× {it.name}
                {it.notes && (
                  <span className="block text-xs text-muted-foreground">{it.notes}</span>
                )}
              </span>
              <span className="shrink-0">{money(it.price * it.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>5% GST</span>
            <span>{money(gst)}</span>
          </div>
          <div className="flex justify-between pt-2 text-lg font-semibold text-foreground">
            <span>Total Amount</span>
            <span className="text-primary">{money(totalAmount)}</span>
          </div>
        </div>
      </div>
    );
  }

  function ActionPanel() {
    return (
      <div className="mt-8 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left px-1">
          Next Steps
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <Button
            type="button"
            variant="secondary"
            className="h-14 w-full justify-start px-4 text-base font-semibold active:scale-95 shadow-sm"
            onClick={handleOrderMore}
          >
            <PlusCircle className="mr-3 h-5 w-5 text-primary shrink-0" />
            <span>Order More Items</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-14 w-full justify-start px-4 text-base font-semibold active:scale-95 shadow-sm"
            disabled={paying}
            onClick={handlePayCash}
          >
            <Banknote className="mr-3 h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Pay by Cash</span>
          </Button>

          <Button
            type="button"
            className="h-14 w-full justify-start px-4 text-base font-semibold active:scale-95 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={paying}
            onClick={handleUPIPayment}
          >
            {paying ? (
              <Loader2 className="mr-3 h-5 w-5 animate-spin shrink-0" />
            ) : (
              <Smartphone className="mr-3 h-5 w-5 shrink-0" />
            )}
            <span>Pay Online (UPI)</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background pb-16">
      <div className="mx-auto w-full max-w-md px-5 pt-10">
        <div className="flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-5 w-5 shrink-0" />
          <span className="font-display text-xl font-semibold text-foreground">Tablepe</span>
        </div>

        {showConfirmScreen && isServed && !isCompleted && !isPaymentRequested ? (
          <div className="mt-8 flex flex-col items-center text-center surface-card p-6 rounded-3xl border border-border shadow-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Smartphone className="h-8 w-8 animate-pulse" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-foreground">
              Did you complete the payment on your UPI app?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              If your transaction succeeded, click "Yes, Payment Sent" to notify the cashier to confirm your bill.
            </p>
            <BillSummary />
            <div className="mt-6 space-y-3 w-full">
              <Button
                size="lg"
                className="h-14 w-full text-base font-bold shadow-md active:scale-95 transition-all bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={paying}
                onClick={handleConfirmPaymentSent}
              >
                {paying ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                )}
                Yes, Payment Sent
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-14 w-full text-base font-semibold active:scale-95"
                disabled={paying}
                onClick={handleCancelConfirm}
              >
                Cancel / Retry
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="mt-24 flex justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !data ? (
          <div className="mt-24 flex flex-col items-center justify-center text-center">
            <h1 className="mt-4 text-2xl font-bold text-foreground">Ticket Not Found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn't find the ticket details for this order.
            </p>
            <Button asChild variant="outline" className="mt-6 h-12 w-full active:scale-95">
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        ) : isCompleted ? (
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shadow-inner">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h1 className="mt-6 text-3xl font-extrabold text-foreground">Payment Confirmed!</h1>
            <p className="mt-2 text-base text-muted-foreground max-w-xs">
              {data.table_number ? `Table ${data.table_number} · ` : ""}Your bill has been settled. Thank you for dining with us!
            </p>
            <Button
              size="lg"
              className="mt-8 h-16 w-full text-lg font-bold shadow-lg active:scale-95 transition-all"
              onClick={handleEndSession}
            >
              End Session &amp; Leave
            </Button>
          </div>
        ) : isPaymentRequested ? (
          <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
            <h1 className="mt-6 text-2xl font-semibold leading-snug">
              Bill Requested
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              A waiter will be with you shortly to collect your payment of {money(totalAmount)}.
            </p>
            <BillSummary />
          </div>
        ) : isServed ? (
          <>
            <div className="mt-8 flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PartyPopper className="h-8 w-8" />
              </div>
              <h1 className="mt-5 text-3xl font-semibold">Enjoy your meal!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.table_number ? `Table ${data.table_number}` : ""} — settle up or order more when ready.
              </p>
            </div>
            <BillSummary />
            <ActionPanel />
          </>
        ) : (
          <>
            <h1 className="mt-6 text-3xl font-semibold">Order in motion</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.table_number ? `Table ${data.table_number}` : ""}
              {data.guest_name ? ` · Guest: ${data.guest_name}` : ""}
            </p>

            <ol className="mt-8 space-y-3">
              {STEPS.map((step, i) => {
                const done = i <= currentIndex;
                return (
                  <li
                    key={step}
                    className={`flex items-center gap-3 rounded-xl border p-4 ${
                      done ? "border-primary bg-primary/10" : "border-border bg-card"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                        done
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="min-w-0 font-medium">{LABELS[step]}</span>
                    {i === currentIndex && !showBill && (
                      <span className="pulse-dot ml-auto h-2 w-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex flex-col items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground active:scale-95"
                disabled={isRefreshing || isLoading}
                onClick={handleManualRefresh}
              >
                <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing || isLoading ? "animate-spin" : ""}`} />
                <span>{isRefreshing ? "Syncing..." : "Refresh Status"}</span>
              </Button>
              <p className="text-[11px] text-muted-foreground/75 text-center">
                Screen locked? Tap refresh to get the latest kitchen updates.
              </p>
            </div>

            <div className="surface-card mt-8 rounded-2xl p-5">
              <h2 className="text-base font-semibold">Items</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.items.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      {it.qty}× {it.name}
                      {it.notes && (
                        <span className="block text-xs text-muted-foreground">{it.notes}</span>
                      )}
                    </span>
                    <span className="shrink-0">{money(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t border-border pt-3 font-semibold">
                <span>Total</span>
                <span>{money(data.total)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
