import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AnimatedToastProvider } from "@/components/AnimatedToast";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { title: `${restaurantName} | Restaurant Management` },
        {
          name: "description",
          content:
            `${restaurantName} runs the dining room: mobile guest check-in, waitlist allocation, QR menu ordering and a live kitchen board.`,
        },
        { name: "author", content: restaurantName },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=DM+Sans:wght@400;500;700&display=swap",
        },
        { rel: "icon", href: "/favicon.svg" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function TableReadyAlert() {
  const [tableReadyData, setTableReadyData] = useState<any | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const waitlistId = localStorage.getItem("active_waitlist_id");
    if (!waitlistId) return;

    (supabase.from("waitlist") as any)
      .select("*")
      .eq("id", waitlistId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data && (data.status === "notified" || data.status === "seated")) {
          setTableReadyData(data);
        }
      });

    const channel = supabase
      .channel(`waitlist-active-${waitlistId}`)
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
          if (updated && (updated.status === "notified" || updated.status === "seated")) {
            setTableReadyData(updated);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!tableReadyData) return null;

  const tableNum = tableReadyData.assigned_table || tableReadyData.table_number || "X";

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("active_waitlist_id");
    }
    setTableReadyData(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 p-6 backdrop-blur-md text-white text-center animate-in fade-in duration-200">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 text-white shadow-2xl animate-bounce">
        <Sparkles className="h-10 w-10" />
      </div>
      <h2 className="mt-6 font-display text-4xl font-extrabold tracking-tight">
        Your Table is Ready! 🎉
      </h2>
      <p className="mt-4 text-xl font-medium text-emerald-300">
        Please head over to <strong className="text-white underline underline-offset-4 font-bold text-2xl">Table {tableNum}</strong>.
      </p>
      <p className="mt-2 text-sm text-gray-300">
        Our team is waiting to welcome you and start serving your meal.
      </p>
      <Button
        onClick={handleDismiss}
        className="mt-8 h-14 w-full max-w-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-xl active:scale-95 rounded-2xl"
      >
        Dismiss &amp; View Menu
      </Button>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  return (
    <QueryClientProvider client={queryClient}>
      <AnimatedToastProvider>
        {isDemoMode && (
          <div className="sticky top-0 z-50 bg-red-600 text-white text-center py-2 text-sm font-bold">
            DEMO MODE — Sample restaurant &amp; data. Nothing here affects live accounts.
          </div>
        )}
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <TableReadyAlert />
        <Toaster position="top-center" richColors />
      </AnimatedToastProvider>
    </QueryClientProvider>
  );
}
