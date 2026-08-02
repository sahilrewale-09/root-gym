import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/thank-you")({
  head: () => ({
    meta: [
      { title: "Thank You — Tablepe" },
      { name: "description", content: "It's been a pleasure serving you. We hope to see you again soon." },
      { property: "og:title", content: "Thank You — Tablepe" },
      { property: "og:description", content: "It's been a pleasure serving you. We hope to see you again soon." },
    ],
  }),
  component: ThankYouPage,
});

function ThankYouPage() {
  return (
    <main className="min-h-screen flex items-center justify-center overflow-x-hidden bg-background px-5 py-12">
      <div className="mx-auto w-full max-w-md surface-card flex flex-col items-center rounded-3xl p-8 border border-border shadow-xl text-center">
        <div className="flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-6 w-6 shrink-0" />
          <span className="font-display text-2xl font-bold text-foreground">Tablepe</span>
        </div>

        <div className="my-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shadow-inner">
          <CheckCircle2 className="h-16 w-16" />
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Thank You!</h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          It's been a pleasure serving you. We hope to see you again soon.
        </p>

        <div className="mt-8 w-full">
          <Button asChild variant="outline" className="h-14 w-full text-base font-semibold active:scale-95">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
