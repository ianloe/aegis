import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { KeyRound, Plus, Shield, Trash2, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function RoleBadge({ role }: { role: string }) {
  return role === "admin" ? (
    <Badge variant="outline" className="text-indigo-400 border-indigo-400/30 bg-indigo-400/5 text-[10px] capitalize">
      <Shield className="w-3 h-3 mr-1" />
      Admin
    </Badge>
  ) : (
    <Badge variant="outline" className="text-slate-400 border-slate-400/30 bg-slate-400/5 text-[10px] capitalize">
      User
    </Badge>
  );
}

function CreateUserModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  const createMutation = trpc.adminUsers.create.useMutation({
    onSuccess: () => {
      toast.success("User created successfully");
      setOpen(false);
      setUsername(""); setPassword(""); setName(""); setEmail(""); setRole("user");
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({ username, password, name: name || undefined, email: email || undefined, role });
          }}
        >
          <div className="space-y-1">
            <Label>Username <span className="text-red-400">*</span></Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. jsmith" required />
          </div>
          <div className="space-y-1">
            <Label>Password <span className="text-red-400">*</span></Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required minLength={8} />
          </div>
          <div className="space-y-1">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. jane@example.com" />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordModal({ userId, username }: { userId: number; username: string }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const resetMutation = trpc.adminUsers.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(`Password reset for ${username}`);
      setOpen(false);
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-yellow-400">
          <KeyRound className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password — {username}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            resetMutation.mutate({ id: userId, newPassword });
          }}
        >
          <div className="space-y-1">
            <Label>New Password <span className="text-red-400">*</span></Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" required minLength={8} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const { data: users = [], isLoading } = trpc.adminUsers.list.useQuery();

  const updateRoleMutation = trpc.adminUsers.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.adminUsers.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.adminUsers.delete.useMutation({
    onSuccess: () => {
      toast.success("User deleted");
      utils.adminUsers.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRoleChange = (id: number, role: "user" | "admin") => {
    updateRoleMutation.mutate({ id, role });
  };

  const handleDelete = (id: number, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id });
  };

  return (
    <AegisLayout title="User Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <UserCog className="w-6 h-6 text-indigo-400" />
              User Management
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage platform accounts, roles, and access credentials.
            </p>
          </div>
          <CreateUserModal onCreated={() => utils.adminUsers.list.invalidate()} />
        </div>

        <Card className="bg-slate-900/60 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300">
              All Users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-slate-500 text-sm">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No users found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700/50 hover:bg-transparent">
                    <TableHead className="text-slate-400 text-xs">Username</TableHead>
                    <TableHead className="text-slate-400 text-xs">Name</TableHead>
                    <TableHead className="text-slate-400 text-xs">Email</TableHead>
                    <TableHead className="text-slate-400 text-xs">Role</TableHead>
                    <TableHead className="text-slate-400 text-xs">Created</TableHead>
                    <TableHead className="text-slate-400 text-xs">Last Sign-in</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <TableRow key={u.id} className="border-slate-700/30 hover:bg-slate-800/30">
                        <TableCell className="font-mono text-xs text-white">{u.username}</TableCell>
                        <TableCell className="text-xs text-slate-300">{u.name ?? <span className="text-slate-600">—</span>}</TableCell>
                        <TableCell className="text-xs text-slate-400">{u.email ?? <span className="text-slate-600">—</span>}</TableCell>
                        <TableCell>
                          <RoleBadge role={u.role} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString("en-GB")}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(u.lastSignedIn).toLocaleDateString("en-GB")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isSelf && (
                              <Select
                                value={u.role}
                                onValueChange={(v) => handleRoleChange(u.id, v as "user" | "admin")}
                              >
                                <SelectTrigger className="h-7 w-24 text-[10px] bg-slate-800 border-slate-600">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <ResetPasswordModal userId={u.id} username={u.username} />
                            {!isSelf && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-slate-400 hover:text-red-400"
                                onClick={() => handleDelete(u.id, u.username)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AegisLayout>
  );
}
