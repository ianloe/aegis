import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

export default function Register() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
    email: "",
    inviteCode: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      await utils.auth.me.invalidate();
      navigate("/dashboard");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.username.trim()) { setError("Username is required."); return; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(form.username)) {
      setError("Username may only contain letters, numbers, underscores, dots and hyphens.");
      return;
    }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }

    registerMutation.mutate({
      username: form.username.trim(),
      password: form.password,
      name: form.name.trim() || undefined,
      email: form.email.trim() || undefined,
      inviteCode: form.inviteCode.trim() || undefined,
    });
  };

  const passwordStrength = () => {
    const p = form.password;
    if (!p) return null;
    if (p.length < 8) return { label: "Too short", color: "text-red-400" };
    if (p.length < 12) return { label: "Acceptable", color: "text-yellow-400" };
    if (/[A-Z]/.test(p) && /[0-9]/.test(p) && /[^a-zA-Z0-9]/.test(p)) return { label: "Strong", color: "text-emerald-400" };
    return { label: "Moderate", color: "text-blue-400" };
  };

  const strength = passwordStrength();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Aegis</h1>
          <p className="text-sm text-muted-foreground mt-1">AI Governance &amp; Safety Platform</p>
        </div>

        <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Create your account</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              The first account registered automatically becomes the administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-sm font-medium">Username <span className="text-red-400">*</span></Label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    value={form.username}
                    onChange={set("username")}
                    placeholder="admin"
                    className="bg-background/60 border-border/60 focus:border-indigo-500"
                    disabled={registerMutation.isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium">Display name</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Ian Loe"
                    className="bg-background/60 border-border/60 focus:border-indigo-500"
                    disabled={registerMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@organisation.com"
                  className="bg-background/60 border-border/60 focus:border-indigo-500"
                  disabled={registerMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">Password <span className="text-red-400">*</span></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Min. 8 characters"
                    className="bg-background/60 border-border/60 focus:border-indigo-500 pr-10"
                    disabled={registerMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {strength && (
                  <p className={`text-xs ${strength.color}`}>Password strength: {strength.label}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password <span className="text-red-400">*</span></Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    placeholder="Repeat password"
                    className="bg-background/60 border-border/60 focus:border-indigo-500 pr-10"
                    disabled={registerMutation.isPending}
                  />
                  {form.confirmPassword && form.password === form.confirmPassword && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inviteCode" className="text-sm font-medium">
                  Invite code <span className="text-muted-foreground text-xs">(required for non-first users)</span>
                </Label>
                <Input
                  id="inviteCode"
                  type="text"
                  value={form.inviteCode}
                  onChange={set("inviteCode")}
                  placeholder="Leave blank if you are the first user"
                  className="bg-background/60 border-border/60 focus:border-indigo-500"
                  disabled={registerMutation.isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium mt-2"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Creating account…" : "Create account"}
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-border/40 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  onClick={(e) => { e.preventDefault(); navigate("/login"); }}
                >
                  Sign in
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
