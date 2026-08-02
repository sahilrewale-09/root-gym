import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Lock, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin-login")({
  head: () => {
    const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";
    return {
      meta: [
        { title: `Staff Login — ${restaurantName} Admin` },
        { name: "description", content: `Staff portal login for ${restaurantName} restaurant management system.` },
        { property: "og:title", content: `Staff Login — ${restaurantName} Admin` },
      ],
    };
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || "Your Restaurant";
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  async function registerActiveSession() {
    const sessionId = crypto.randomUUID();
    localStorage.setItem("active_session_id", sessionId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await (supabase.from("profiles") as any)
        .update({ current_session_id: sessionId })
        .eq("id", user.id);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);

    if (error) {
      toast.error(error.message || "Invalid login credentials");
      return;
    }

    await registerActiveSession();
    await (supabase.rpc as any)("toggle_online_status", { p_status: true });

    toast.success("Logged in successfully!");
    navigate({ to: "/admin" });
  }

  async function handleDemoLogin(role: "owner" | "manager" | "staff") {
    setLoading(true);
    const demoEmail = `${role}@demobistro.com`;
    const demoPassword = "demo123";
    const { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || `Failed to log in as ${role}`);
      return;
    }

    await registerActiveSession();
    await (supabase.rpc as any)("toggle_online_status", { p_status: true });

    toast.success(`Logged in as ${role.toUpperCase()}`);
    const targetRoute = role === "staff" ? "/admin/tables" : "/admin";
    navigate({ to: targetRoute });
  }

  return (
    <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="mt-4 flex items-center gap-2 text-primary">
            <UtensilsCrossed className="h-5 w-5 shrink-0" />
            <span className="font-display text-xl font-bold text-foreground">{restaurantName} Admin</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold text-foreground">Staff Portal Login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your credentials to access the management dashboard.
          </p>
        </div>

        <div className="surface-card mt-8 rounded-3xl p-6 sm:p-8 border border-border shadow-xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="staff@restaurant.com"
                className="h-13 text-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-13 text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-14 w-full text-base font-bold shadow-md active:scale-95 transition-all"
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Lock className="mr-2 h-5 w-5" />
              )}
              Login to Dashboard
            </Button>
          </form>

          {isDemoMode && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>Quick Demo Login</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin("owner")}
                  className="h-11 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs active:scale-95 transition-all shadow-sm px-1"
                >
                  Demo Owner
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin("manager")}
                  className="h-11 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs active:scale-95 transition-all shadow-sm px-1"
                >
                  Demo Manager
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin("staff")}
                  variant="outline"
                  className="h-11 w-full font-semibold text-xs active:scale-95 transition-all px-1"
                >
                  Demo Staff
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
