import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffAdmin,
});

type Role = "staff" | "chef" | "manager" | "owner";

function StaffAdmin() {
  const qc = useQueryClient();
  const { data: people = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      return (profiles.data ?? []).map((p) => ({
        ...p,
        role: (roles.data ?? []).find((r) => r.user_id === p.id)?.role ?? "staff",
      }));
    },
  });

  async function setRole(userId: string, role: Role) {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff"] });
    toast.success("Role updated");
  }

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold">Staff</h1>
      <div className="mt-5 space-y-3">
        {people.map((p) => (
          <div
            key={p.id}
            className="surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.full_name ?? p.email}</p>
              <p className="truncate text-xs text-muted-foreground">{p.email}</p>
            </div>
            <Select value={p.role} onValueChange={(v) => setRole(p.id, v as Role)}>
              <SelectTrigger className="h-11 w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="chef">Chef</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
