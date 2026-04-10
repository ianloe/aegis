import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Lock, Plus, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const tierConfig = {
  benign: { label: "Benign", icon: ShieldCheck, color: "text-green-400", border: "border-green-400/20", bg: "bg-green-400/5", desc: "Public or non-sensitive data. Minimal access controls required." },
  internal: { label: "Internal", icon: Shield, color: "text-yellow-400", border: "border-yellow-400/20", bg: "bg-yellow-400/5", desc: "Internal business data. Restricted to authorised personnel and systems." },
  sensitive: { label: "Sensitive", icon: ShieldAlert, color: "text-red-400", border: "border-red-400/20", bg: "bg-red-400/5", desc: "PII, financial records, and confidential data. Strictest controls apply." },
};

export default function DataPolicies() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tier: "benign" as "benign" | "internal" | "sensitive",
    description: "",
    allowedTools: "",
    rules: {
      requireApproval: false,
      logAllAccess: true,
      maskPii: false,
      blockExternalTransfer: false,
      requireMfa: false,
    },
  });

  const { data: policies, isLoading, refetch } = trpc.policies.list.useQuery();
  const createMutation = trpc.policies.create.useMutation({
    onSuccess: () => { toast.success("Policy created"); setOpen(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error("Policy name is required");
    createMutation.mutate({
      name: form.name,
      tier: form.tier,
      description: form.description || undefined,
      allowedTools: form.allowedTools ? form.allowedTools.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      enforcementRules: form.rules,
    });
  };

  const grouped = {
    benign: policies?.filter((p) => p.tier === "benign") ?? [],
    internal: policies?.filter((p) => p.tier === "internal") ?? [],
    sensitive: policies?.filter((p) => p.tier === "sensitive") ?? [],
  };

  return (
    <AegisLayout title="Data Classification Policies">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Define data sensitivity tiers and enforcement rules for AI tool access.</p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />New Policy</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create Data Policy</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Policy Name *</Label>
                  <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. Customer PII Policy" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data Sensitivity Tier</Label>
                  <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v as "benign" | "internal" | "sensitive" })}>
                    <SelectTrigger className="mt-1 bg-input border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="benign">Benign</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="sensitive">Sensitive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Textarea className="mt-1 bg-input border-border text-foreground resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Allowed Tools (comma-separated)</Label>
                  <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. web_search, calculator, email" value={form.allowedTools} onChange={(e) => setForm({ ...form, allowedTools: e.target.value })} />
                </div>
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-medium text-foreground">Enforcement Rules</p>
                  {[
                    { key: "requireApproval", label: "Require human approval for access" },
                    { key: "logAllAccess", label: "Log all access events" },
                    { key: "maskPii", label: "Mask PII in responses" },
                    { key: "blockExternalTransfer", label: "Block external data transfer" },
                    { key: "requireMfa", label: "Require MFA for access" },
                  ].map((rule) => (
                    <div key={rule.key} className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">{rule.label}</Label>
                      <Switch
                        checked={form.rules[rule.key as keyof typeof form.rules]}
                        onCheckedChange={(v) => setForm({ ...form, rules: { ...form.rules, [rule.key]: v } })}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Policy"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tier Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["benign", "internal", "sensitive"] as const).map((tier) => {
            const cfg = tierConfig[tier];
            const Icon = cfg.icon;
            return (
              <Card key={tier} className={`border ${cfg.border} ${cfg.bg}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                    <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                    <Badge variant="outline" className={`ml-auto text-[10px] ${cfg.color} border-current/30`}>
                      {grouped[tier].length} {grouped[tier].length === 1 ? "policy" : "policies"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{cfg.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Policy List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl shimmer" />)}
          </div>
        ) : policies?.length === 0 ? (
          <Card className="glass-card border-border">
            <CardContent className="py-16 text-center">
              <Lock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No data policies defined yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Create policies to govern how AI agents access data at each sensitivity tier.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(["sensitive", "internal", "benign"] as const).map((tier) =>
              grouped[tier].length > 0 ? (
                <div key={tier}>
                  <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${tierConfig[tier].color}`}>{tierConfig[tier].label} Tier</p>
                  <div className="space-y-2">
                    {grouped[tier].map((policy) => {
                      const rules = policy.enforcementRules as Record<string, boolean> | null;
                      const tools = policy.allowedTools as string[] | null;
                      return (
                        <Card key={policy.id} className="glass-card border-border">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-foreground">{policy.name}</p>
                                  <Badge variant="outline" className={`text-[9px] capitalize ${tierConfig[tier].color} border-current/30`}>{tier}</Badge>
                                </div>
                                {policy.description && <p className="text-xs text-muted-foreground mb-2">{policy.description}</p>}
                                <div className="flex flex-wrap gap-2">
                                  {tools && tools.length > 0 && tools.map((t) => (
                                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="shrink-0 space-y-1 text-right">
                                {rules && Object.entries(rules).filter(([, v]) => v).map(([k]) => (
                                  <Badge key={k} variant="outline" className="text-[9px] block text-muted-foreground">
                                    {k.replace(/([A-Z])/g, " $1").toLowerCase()}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </AegisLayout>
  );
}
