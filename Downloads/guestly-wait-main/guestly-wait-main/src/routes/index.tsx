import { createFileRoute } from "@tanstack/react-router";
import { QrCode, Clock, MapPin, Sparkles, UtensilsCrossed, Heart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => {
    const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";
    return {
      meta: [
        { title: `${restaurantName} — Fine Dining & Digital QR Ordering` },
        {
          name: "description",
          content:
            `Welcome to ${restaurantName}! Enjoy authentic cuisine. Dine-in customers can scan their table QR code to view our digital menu and order.`,
        },
        { property: "og:title", content: `${restaurantName} — Fine Dining` },
        {
          property: "og:description",
          content: "Serving authentic cuisine. Scan your table QR code to order.",
        },
      ],
    };
  },
  component: PublicLanding,
});

function PublicLanding() {
  const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";

  return (
    <main className="min-h-screen overflow-x-hidden bg-background flex flex-col justify-between">
      {/* Top Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight text-foreground">
            {restaurantName}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Open Today
        </span>
      </header>

      {/* Main Hero Content */}
      <section className="mx-auto w-full max-w-md px-6 py-12 text-center sm:max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Authentic Cuisine</span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl leading-[1.1]">
          Welcome to <span className="text-primary">{restaurantName}</span>
        </h1>
        
        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
          Serving authentic, handcrafted delicacies prepared with rich spices and fresh local ingredients.
        </p>

        {/* QR Scan Instruction Box */}
        <div className="surface-card mt-10 rounded-3xl p-6 sm:p-8 border-2 border-primary/20 shadow-xl bg-card text-left space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Ready to Order?</h2>
              <p className="text-xs text-muted-foreground">Scan from your phone camera</p>
            </div>
          </div>
          <p className="text-sm font-medium leading-relaxed text-foreground/90 bg-muted/50 p-4 rounded-xl border border-border/50">
            <strong className="text-primary font-bold">Dine-in customers:</strong> Please scan the QR code located on your table to view our digital menu and place your order.
          </p>
        </div>

        {/* Restaurant Info Chips */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <div className="surface-card rounded-2xl p-4 border border-border flex items-start gap-3">
            <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hours</p>
              <p className="text-sm font-bold text-foreground mt-0.5">10:00 AM - 11:00 PM</p>
            </div>
          </div>
          <div className="surface-card rounded-2xl p-4 border border-border flex items-start gap-3">
            <MapPin className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</p>
              <p className="text-sm font-bold text-foreground mt-0.5">Main Street, Dining Quarter</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-1">
          Made with <Heart className="h-3.5 w-3.5 text-destructive fill-destructive" /> by {restaurantName} Fine Dining
        </p>
      </footer>
    </main>
  );
}
