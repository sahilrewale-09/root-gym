import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "chef" | "staff" | "manager" | "owner";

export function useRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      setEmail(userData.user?.email ?? null);
      if (!userData.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      if (!active) return;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      setRole(
        roles.includes("owner")
          ? "owner"
          : roles.includes("manager")
            ? "manager"
            : roles.includes("chef")
              ? "chef"
              : roles.includes("staff")
                ? "staff"
                : roles[0] ?? "staff",
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const rank: Record<AppRole, number> = { chef: 1, staff: 1, manager: 2, owner: 3 };
  const atLeast = (r: AppRole) => !!role && rank[role] >= rank[r];

  return {
    role,
    email,
    loading,
    atLeast,
    isOwner: role === "owner",
    isManager: role === "manager",
    isStaff: role === "staff",
    isChef: role === "chef",
  };
}

let audioCtx: AudioContext | null = null;

export function playChime() {
  if (typeof window === "undefined") return;
  try {
    audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    /* audio not available */
  }
}
