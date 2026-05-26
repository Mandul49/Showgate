import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getUser } from "@/lib/auth";
import { UserPlus, X, Plus, UserX, UsersRound, ShieldAlert } from "lucide-react";
import type { AdminTeamMember, AdminRole } from "@shared/schema";

// ── Helpers ────────────────────────────────────────────────────────────────────

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

const ALL_ROLES: AdminRole[] = ["super_admin", "admin", "support", "finance"];

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Form schemas ──────────────────────────────────────────────────────────────

const addSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["super_admin", "admin", "support", "finance"] as const),
  note: z.string().max(500).optional(),
});
type AddFormValues = z.infer<typeof addSchema>;

const addRoleSchema = z.object({
  role: z.enum(["super_admin", "admin", "support", "finance"] as const),
  note: z.string().max(500).optional(),
});
type AddRoleFormValues = z.infer<typeof addRoleSchema>;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminTeam() {
  const { toast } = useToast();
  const currentUser = getUser();
  const myAdminRoles = (currentUser?.adminRoles ?? []) as AdminRole[];
  const isSuperAdmin = myAdminRoles.includes("super_admin");

  const [addOpen, setAddOpen] = useState(false);
  const [addRoleTarget, setAddRoleTarget] = useState<AdminTeamMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminTeamMember | null>(null);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: team = [], isLoading } = useQuery<AdminTeamMember[]>({
    queryKey: ["/api/admin/team"],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: (data: AddFormValues) => apiRequest("POST", "/api/admin/team", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
      setAddOpen(false);
      addForm.reset();
      toast({ title: "Admin access granted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addRoleMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AddRoleFormValues }) =>
      apiRequest("POST", `/api/admin/team/${userId}/roles`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
      setAddRoleTarget(null);
      addRoleForm.reset();
      toast({ title: "Role added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AdminRole }) =>
      apiRequest("DELETE", `/api/admin/team/${userId}/roles/${role}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
      toast({ title: "Role removed" });
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

  // ── Forms ──────────────────────────────────────────────────────────────────
  const addForm = useForm<AddFormValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { email: "", role: "admin", note: "" },
  });

  const addRoleForm = useForm<AddRoleFormValues>({
    resolver: zodResolver(addRoleSchema),
    defaultValues: { role: "admin", note: "" },
  });

  // Available roles the current super_admin can grant
  const grantableRoles: AdminRole[] = isSuperAdmin
    ? ALL_ROLES
    : (["admin", "support", "finance"] as AdminRole[]);

  function openAddRole(member: AdminTeamMember) {
    const unassigned = grantableRoles.filter(r => !member.adminRoles.includes(r));
    if (unassigned.length === 0) {
      toast({ title: "All roles assigned", description: "This admin already has all available roles." });
      return;
    }
    setAddRoleTarget(member);
    addRoleForm.reset({ role: unassigned[0], note: "" });
  }

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
            onClick={() => { addForm.reset(); setAddOpen(true); }}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Admin
          </Button>
        </div>

        {/* ── Role legend ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {ALL_ROLES.map(role => (
            <div key={role} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mb-2 ${ROLE_BADGE[role]}`}>
                {ROLE_LABEL[role]}
              </span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {role === "super_admin" && "Full access including settings and team management"}
                {role === "admin"       && "Full access except settings and team management"}
                {role === "support"     && "View organizers and events, no editing"}
                {role === "finance"     && "View analytics and subscriptions only"}
              </p>
            </div>
          ))}
        </div>

        {/* ── Table ──────────────────────────────────────────────── */}
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
                  const unassigned = grantableRoles.filter(r => !member.adminRoles.includes(r));
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
                            member.adminRoles.map(role => {
                              const isSelfSuperAdmin = isSelf && role === "super_admin";
                              return (
                                <span
                                  key={role}
                                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${ROLE_BADGE[role]}`}
                                >
                                  {ROLE_LABEL[role]}
                                  {!isSelfSuperAdmin && (
                                    <button
                                      onClick={() => removeRoleMutation.mutate({ userId: member.id, role })}
                                      className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                      title={`Remove ${ROLE_LABEL[role]} role`}
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </span>
                              );
                            })
                          )}
                          {unassigned.length > 0 && (
                            <button
                              onClick={() => openAddRole(member)}
                              className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 rounded px-1.5 py-0.5 transition-colors"
                              title="Add another role"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              Add role
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{fmtDate(member.adminAddedAt)}</td>
                      <td className="px-4 py-3 text-zinc-400">{fmtDate(member.lastLoginAt)}</td>
                      <td className="px-4 py-3 text-zinc-400 truncate max-w-[160px]">
                        {member.adminAddedBy ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
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
            <form onSubmit={addForm.handleSubmit(data => addMutation.mutate(data))} className="space-y-4">
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
              <FormField
                control={addForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Initial role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-zinc-800 border-zinc-600 text-zinc-100">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {grantableRoles.map(r => (
                          <SelectItem key={r} value={r} className="text-zinc-100 focus:bg-zinc-700">
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-zinc-500">You can add more roles after creation.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Note <span className="text-zinc-500 font-normal">(optional)</span></FormLabel>
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
                <Button type="button" variant="ghost" onClick={() => setAddOpen(false)} className="text-zinc-400 hover:text-zinc-100">Cancel</Button>
                <Button type="submit" disabled={addMutation.isPending} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                  {addMutation.isPending ? "Granting..." : "Grant Admin Access"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Add Role Dialog ──────────────────────────────────────── */}
      <Dialog open={!!addRoleTarget} onOpenChange={open => !open && setAddRoleTarget(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Add Role</DialogTitle>
          </DialogHeader>
          {addRoleTarget && (
            <Form {...addRoleForm}>
              <form
                onSubmit={addRoleForm.handleSubmit(data =>
                  addRoleMutation.mutate({ userId: addRoleTarget.id, data })
                )}
                className="space-y-4"
              >
                <p className="text-sm text-zinc-400">
                  Adding a role to <span className="text-zinc-100 font-medium">{addRoleTarget.email}</span>
                </p>
                <FormField
                  control={addRoleForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">Role to add</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-zinc-800 border-zinc-600 text-zinc-100">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          {grantableRoles
                            .filter(r => !addRoleTarget.adminRoles.includes(r))
                            .map(r => (
                              <SelectItem key={r} value={r} className="text-zinc-100 focus:bg-zinc-700">
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addRoleForm.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">Note <span className="text-zinc-500 font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Reason for this role..."
                          className="bg-zinc-800 border-zinc-600 text-zinc-100 placeholder-zinc-500 resize-none"
                          rows={2}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setAddRoleTarget(null)} className="text-zinc-400 hover:text-zinc-100">Cancel</Button>
                  <Button type="submit" disabled={addRoleMutation.isPending} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                    {addRoleMutation.isPending ? "Adding..." : "Add Role"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Remove All Access Confirmation ───────────────────────── */}
      <AlertDialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove all admin access?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Remove admin access for <span className="text-zinc-100 font-medium">{removeTarget?.email}</span>?
              They will lose all roles and return to being a regular user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700">Cancel</AlertDialogCancel>
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
