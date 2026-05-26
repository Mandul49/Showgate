import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getUser } from "@/lib/auth";
import { UserPlus, Pencil, UserX, UsersRound, ShieldAlert } from "lucide-react";
import type { AdminTeamMember, AdminRole } from "@shared/schema";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<AdminRole, string> = {
  super_admin: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  admin:       "bg-blue-500/15 text-blue-400 border border-blue-500/25",
  support:     "bg-green-500/15 text-green-400 border border-green-500/25",
  finance:     "bg-purple-500/15 text-purple-400 border border-purple-500/25",
};

const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin:       "Admin",
  support:     "Support",
  finance:     "Finance",
};

const ROLE_DESC: Record<AdminRole, string> = {
  super_admin: "Full access including settings and team management",
  admin:       "Full access except settings and team management",
  support:     "View organizers and events, no editing",
  finance:     "View analytics and subscriptions only",
};

const ALL_ROLES: AdminRole[] = ["super_admin", "admin", "support", "finance"];

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Form schema ───────────────────────────────────────────────────────────────

const addSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  roles: z.array(z.enum(["super_admin", "admin", "support", "finance"] as const))
    .min(1, "Select at least one role"),
  note: z.string().max(500).optional(),
});
type AddFormValues = z.infer<typeof addSchema>;

// ── Role checkbox component ───────────────────────────────────────────────────

function RoleCheckbox({
  role,
  checked,
  disabled,
  onToggle,
}: {
  role: AdminRole;
  checked: boolean;
  disabled?: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const id = `rc-${role}`;
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        checked
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        className="mt-0.5 border-zinc-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
      />
      <div className="min-w-0">
        <span className={`text-sm font-semibold ${ROLE_BADGE[role].split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
          {ROLE_LABEL[role]}
        </span>
        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{ROLE_DESC[role]}</p>
      </div>
    </label>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminTeam() {
  const { toast } = useToast();
  const currentUser = getUser();
  const myAdminRoles = (currentUser?.adminRoles ?? []) as AdminRole[];
  const isSuperAdmin = myAdminRoles.includes("super_admin");

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminTeamMember | null>(null);
  const [editRoles, setEditRoles] = useState<AdminRole[]>([]);
  const [removeTarget, setRemoveTarget] = useState<AdminTeamMember | null>(null);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: team = [], isLoading } = useQuery<AdminTeamMember[]>({
    queryKey: ["/api/admin/team"],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  // Grant access: one POST per selected role (backend deduplicates)
  const addMutation = useMutation({
    mutationFn: async ({ email, roles, note }: AddFormValues) => {
      for (const role of roles) {
        await apiRequest("POST", "/api/admin/team", { email, role, note });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
      setAddOpen(false);
      addForm.reset({ email: "", roles: [], note: "" });
      toast({ title: "Admin access granted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Edit: diff old roles vs new roles, add/remove as needed
  const editMutation = useMutation({
    mutationFn: async ({ member, newRoles }: { member: AdminTeamMember; newRoles: AdminRole[] }) => {
      const toAdd    = newRoles.filter(r => !member.adminRoles.includes(r));
      const toRemove = member.adminRoles.filter(r => !newRoles.includes(r));
      await Promise.all([
        ...toAdd.map(role    => apiRequest("POST",   `/api/admin/team/${member.id}/roles`, { role })),
        ...toRemove.map(role => apiRequest("DELETE",  `/api/admin/team/${member.id}/roles/${role}`)),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
      setEditTarget(null);
      toast({ title: "Roles updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/admin/team/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
      setRemoveTarget(null);
      toast({ title: "Admin access removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Form ───────────────────────────────────────────────────────────────────
  const addForm = useForm<AddFormValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { email: "", roles: [], note: "" },
  });
  const watchedRoles = addForm.watch("roles") ?? [];

  function toggleAddRole(role: AdminRole, checked: boolean) {
    const current = addForm.getValues("roles") ?? [];
    addForm.setValue(
      "roles",
      checked ? [...current, role] : current.filter(r => r !== role),
      { shouldValidate: true }
    );
  }

  function openEdit(member: AdminTeamMember) {
    setEditTarget(member);
    setEditRoles([...member.adminRoles]);
  }

  function toggleEditRole(role: AdminRole, checked: boolean) {
    setEditRoles(prev => checked ? [...prev, role] : prev.filter(r => r !== role));
  }

  // Roles available based on the acting admin's own permissions
  const grantableRoles: AdminRole[] = isSuperAdmin
    ? ALL_ROLES
    : (["admin", "support", "finance"] as AdminRole[]);

  return (
    <AdminLayout>
      <div className="p-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <UsersRound className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Team</h1>
              <p className="text-sm text-zinc-400 mt-0.5">Manage who has admin access. One user can hold multiple roles.</p>
            </div>
          </div>
          <Button
            onClick={() => { addForm.reset({ email: "", roles: [], note: "" }); setAddOpen(true); }}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Admin
          </Button>
        </div>

        {/* ── Team table ─────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-zinc-500">Loading team...</div>
          ) : team.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-zinc-500">
              <ShieldAlert className="w-8 h-8" />
              <p className="text-sm">No admin team members yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Roles</th>
                  <th className="px-4 py-3 text-left font-medium">Date Added</th>
                  <th className="px-4 py-3 text-left font-medium">Last Login</th>
                  <th className="px-4 py-3 text-left font-medium">Added By</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {team.map(member => {
                  const isSelf = member.id === currentUser?.id;
                  return (
                    <tr key={member.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 text-zinc-100 font-medium">
                        {member.email}
                        {isSelf && (
                          <span className="ml-2 text-[10px] text-zinc-500 font-normal">(you)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {member.adminRoles.length === 0 ? (
                            <span className="text-xs text-zinc-500 italic">No roles</span>
                          ) : (
                            member.adminRoles.map(role => (
                              <span
                                key={role}
                                className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${ROLE_BADGE[role]}`}
                              >
                                {ROLE_LABEL[role]}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{fmtDate(member.adminAddedAt)}</td>
                      <td className="px-4 py-3 text-zinc-400">{fmtDate(member.lastLoginAt)}</td>
                      <td className="px-4 py-3 text-zinc-400 truncate max-w-[140px]">
                        {member.adminAddedBy ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
                            onClick={() => openEdit(member)}
                            title="Edit roles"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => setRemoveTarget(member)}
                            disabled={isSelf}
                            title={isSelf ? "Cannot remove your own access" : "Remove all admin access"}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Add Admin Dialog ─────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Grant Admin Access</DialogTitle>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(data => addMutation.mutate(data))} className="space-y-5">
              {/* Email */}
              <FormField
                control={addForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Email address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="user@example.com"
                        className="bg-zinc-800 border-zinc-600 text-zinc-100 placeholder-zinc-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Roles — checkboxes */}
              <FormField
                control={addForm.control}
                name="roles"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Roles</FormLabel>
                    <div className="space-y-2 mt-1">
                      {grantableRoles.map(role => (
                        <RoleCheckbox
                          key={role}
                          role={role}
                          checked={watchedRoles.includes(role)}
                          onToggle={checked => toggleAddRole(role, !!checked)}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Note */}
              <FormField
                control={addForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">
                      Note <span className="text-zinc-500 font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Why are you granting this access?"
                        className="bg-zinc-800 border-zinc-600 text-zinc-100 placeholder-zinc-500 resize-none"
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setAddOpen(false)} className="text-zinc-400 hover:text-zinc-100">
                  Cancel
                </Button>
                <Button type="submit" disabled={addMutation.isPending} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                  {addMutation.isPending ? "Granting..." : "Grant Access"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Roles Dialog ────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Roles</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-5">
              <p className="text-sm text-zinc-400">
                Updating roles for{" "}
                <span className="text-zinc-100 font-medium">{editTarget.email}</span>
              </p>

              <div className="space-y-2">
                {grantableRoles.map(role => {
                  const isSelfSuperAdmin = editTarget.id === currentUser?.id && role === "super_admin";
                  return (
                    <RoleCheckbox
                      key={role}
                      role={role}
                      checked={editRoles.includes(role)}
                      disabled={isSelfSuperAdmin}
                      onToggle={checked => toggleEditRole(role, !!checked)}
                    />
                  );
                })}
              </div>

              {editRoles.length === 0 && (
                <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
                  Deselecting all roles will remove admin access entirely.
                </p>
              )}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditTarget(null)} className="text-zinc-400 hover:text-zinc-100">
                  Cancel
                </Button>
                <Button
                  onClick={() => editMutation.mutate({ member: editTarget, newRoles: editRoles })}
                  disabled={editMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                >
                  {editMutation.isPending ? "Saving..." : "Save Roles"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Remove All Access Confirmation ───────────────────────── */}
      <AlertDialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove all admin access?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Remove admin access for{" "}
              <span className="text-zinc-100 font-medium">{removeTarget?.email}</span>?{" "}
              All of their roles (
              {removeTarget?.adminRoles.map(r => ROLE_LABEL[r]).join(", ") || "none"}
              ) will be revoked and they will return to being a regular user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
              disabled={removeMutation.isPending}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {removeMutation.isPending ? "Removing..." : "Remove All Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
