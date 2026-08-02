import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserCheck, Users, Loader2, UserX, ChefHat } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/team")({
  component: OwnerTeamDashboard,
});

type TeamUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "owner" | "manager" | "staff" | "chef";
  is_online?: boolean;
};

function OwnerTeamDashboard() {
  const { role: currentRole, isOwner, isManager } = useRole();
  const qc = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: currentUserId } = useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("team-profiles-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          qc.invalidateQueries({ queryKey: ["team-members"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => {
          qc.invalidateQueries({ queryKey: ["team-members"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role)");

      if (error) {
        // Fallback manual query if PostgREST relation is not cached
        const [profilesRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("*"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
        return (profilesRes.data ?? []).map((p: any) => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          is_online: p.is_online === true,
          role: ((rolesRes.data ?? []).find((r) => r.user_id === p.id)?.role as TeamUser["role"]) ?? "staff",
        }));
      }

      return (data ?? []).map((p: any) => {
        const roleObj = Array.isArray(p.user_roles) ? p.user_roles[0] : p.user_roles;
        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          is_online: p.is_online === true,
          role: (roleObj?.role as TeamUser["role"]) ?? "staff",
        };
      });
    },
  });

  async function handleForceLogout(targetUserId: string) {
    setUpdatingId(targetUserId);

    const previous = qc.getQueryData<TeamUser[]>(["team-members"]);

    qc.setQueryData<TeamUser[]>(["team-members"], (old = []) =>
      old.map((u) => (u.id === targetUserId ? { ...u, is_online: false } : u)),
    );

    const { error } = await (supabase.rpc as any)("force_logout_user", {
      p_target_user_id: targetUserId,
    });

    setUpdatingId(null);

    if (error) {
      qc.setQueryData(["team-members"], previous);
      toast.error(error.message || "Failed to force logout user");
      return;
    }

    toast.success("User forcefully logged out successfully.");
    qc.invalidateQueries({ queryKey: ["team-members"] });
    qc.invalidateQueries({ queryKey: ["staff"] });
  }

  async function updateRole(targetUserId: string, newRole: "owner" | "manager" | "staff" | "chef") {
    setUpdatingId(targetUserId);

    // Save previous state for optimistic UI rollback
    const previous = qc.getQueryData<TeamUser[]>(["team-members"]);

    // Optimistically update query cache
    qc.setQueryData<TeamUser[]>(["team-members"], (old = []) =>
      old.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u)),
    );

    // Call update_user_role RPC function
    const { error: rpcError } = await (supabase.rpc as any)("update_user_role", {
      p_target_user_id: targetUserId,
      p_new_role: newRole,
    });

    if (rpcError) {
      // Fallback: direct table operation if RPC fails
      await supabase.from("user_roles").delete().eq("user_id", targetUserId);
      const { error: tableError } = await supabase
        .from("user_roles")
        .insert({ user_id: targetUserId, role: newRole as any });

      if (tableError) {
        qc.setQueryData(["team-members"], previous);
        setUpdatingId(null);
        toast.error(tableError.message || "Failed to update role");
        return;
      }
    }

    setUpdatingId(null);
    toast.success(`Role updated to ${newRole.toUpperCase()} successfully!`);
    qc.invalidateQueries({ queryKey: ["team-members"] });
    qc.invalidateQueries({ queryKey: ["staff"] });
  }

  function getRoleBadge(role: string) {
    switch (role) {
      case "owner":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" /> Owner
          </span>
        );
      case "manager":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
            <UserCheck className="h-3.5 w-3.5" /> Manager
          </span>
        );
      case "chef":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-600/10 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
            <ChefHat className="h-3.5 w-3.5" /> Chef
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            <Users className="h-3.5 w-3.5" /> Staff
          </span>
        );
    }
  }

  const canAccess = isOwner || isManager || currentRole === "owner" || currentRole === "manager";

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Access Restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only restaurant Owners and Managers have permission to view team attendance and roles.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Team & Role Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your restaurant team members and track staff attendance.
          </p>
        </div>
      </div>

      <div className="surface-card overflow-hidden rounded-2xl border border-border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-6 py-4">Name</th>
                <th scope="col" className="px-6 py-4">Email</th>
                <th scope="col" className="px-6 py-4">Status</th>
                <th scope="col" className="px-6 py-4">Current Role</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    <p className="mt-2 text-xs">Loading team members...</p>
                  </td>
                </tr>
              ) : teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No team members found.
                  </td>
                </tr>
              ) : (
                teamMembers.map((member) => {
                  const isSelf = member.id === currentUserId;
                  const isTargetOwnerOrManager = member.role === "owner" || member.role === "manager";
                  const canManagerLogoutTarget = !isTargetOwnerOrManager; // Manager can only force logout staff or chef

                  const forceLogoutDisabled =
                    updatingId === member.id ||
                    (currentRole === "manager" && !canManagerLogoutTarget);

                  const roleSelectDisabled =
                    updatingId === member.id ||
                    isSelf ||
                    currentRole === "manager" ||
                    member.role === "owner";

                  return (
                    <tr key={member.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {member.full_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {member.email || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {member.is_online ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            🟢 Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            ⚪ Offline
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getRoleBadge(member.role)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isSelf && (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={forceLogoutDisabled}
                              onClick={() => handleForceLogout(member.id)}
                              className="h-9 px-3 text-xs font-semibold shadow-sm active:scale-95 transition-all"
                            >
                              <UserX className="mr-1.5 h-3.5 w-3.5" />
                              Force Logout
                            </Button>
                          )}
                          {isSelf ? (
                            <div className="flex items-center gap-2">
                              <Select value={member.role} disabled>
                                <SelectTrigger className="h-10 w-36 text-xs font-medium">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="chef">Chef</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="owner">Owner</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                You ({member.role})
                              </span>
                            </div>
                          ) : (
                            <Select
                              value={member.role}
                              disabled={roleSelectDisabled}
                              onValueChange={(val) => updateRole(member.id, val as any)}
                            >
                              <SelectTrigger className="h-10 w-36 text-xs font-medium">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="staff">Staff</SelectItem>
                                <SelectItem value="chef">Chef</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="owner">Owner</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
