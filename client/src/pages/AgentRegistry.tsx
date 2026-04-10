import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, Plus, RefreshCw, Shield, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "text-green-400 border-green-400/30 bg-green-400/5",
    suspended: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    decommissioned: "text-gray-400 border-gray-400/30 bg-gray-400/5",
  };
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${styles[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    benign: "text-green-400 border-green-400/30 bg-green-400/5",
    internal: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    sensitive: "text-red-400 border-red-400/30 bg-red-400/5",
  };
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${styles[tier] ?? ""}`}>
      {tier}
    </Badge>
  );
}

function RiskBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 75 ? "#f87171" : pct >= 50 ? "#fb923c" : pct >= 25 ? "#facc15" : "#4ade80";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{pct.toFixed(0)}</span>
    </div>
  );
}

export default function AgentRegistry() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", agentType: "", vendor: "", version: "", owner: "",
    maxDataTier: "benign" as "benign" | "internal" | "sensitive",
  });

  const { data: agents, isLoading, refetch } = trpc.agents.list.useQuery();
  const createMutation = trpc.agents.create.useMutation({
    onSuccess: () => { toast.success("Agent registered successfully"); setOpen(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateStatusMutation = trpc.agents.updateStatus.useMutation({
    onSuccess: () => { toast.success("Agent status updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const calcRiskMutation = trpc.riskScores.calculate.useMutation({
    onSuccess: (data) => { toast.success(`Risk score calculated: ${data.score.toFixed(1)}`); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error("Agent name is required");
    createMutation.mutate(form);
  };

  return (
    <AegisLayout title="Agent Registry">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Manage and monitor all registered AI agents across your organisation.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Register Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Register New Agent</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Agent Name *</Label>
                      <Input
                        className="mt-1 bg-input border-border text-foreground"
                        placeholder="e.g. Customer Support Bot"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Agent Type</Label>
                      <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. LLM, RAG, Agentic" value={form.agentType} onChange={(e) => setForm({ ...form, agentType: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Vendor</Label>
                      <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. OpenAI, Anthropic" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Version</Label>
                      <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. 1.0.0" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Owner</Label>
                      <Input className="mt-1 bg-input border-border text-foreground" placeholder="Team or person" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Max Data Tier</Label>
                      <Select value={form.maxDataTier} onValueChange={(v) => setForm({ ...form, maxDataTier: v as "benign" | "internal" | "sensitive" })}>
                        <SelectTrigger className="mt-1 bg-input border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="benign">Benign — Public or non-sensitive data only</SelectItem>
                          <SelectItem value="internal">Internal — Internal business data</SelectItem>
                          <SelectItem value="sensitive">Sensitive — PII, financial, confidential</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <Textarea className="mt-1 bg-input border-border text-foreground resize-none" rows={3} placeholder="What does this agent do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Registering..." : "Register Agent"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Agent Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-48 rounded-xl shimmer" />)}
          </div>
        ) : agents?.length === 0 ? (
          <Card className="glass-card border-border">
            <CardContent className="py-16 text-center">
              <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No agents registered yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Register Agent" to add your first AI agent.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents?.map((agent) => (
              <Card key={agent.id} className="glass-card border-border stat-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
                        <p className="text-[10px] text-muted-foreground">{agent.vendor ?? "Unknown vendor"} {agent.version ? `v${agent.version}` : ""}</p>
                      </div>
                    </div>
                    <StatusBadge status={agent.status} />
                  </div>

                  {agent.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{agent.description}</p>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Max Tier</span>
                      <TierBadge tier={agent.maxDataTier} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Risk Score</span>
                    </div>
                    <RiskBar score={Number(agent.riskScore ?? 0)} />
                  </div>

                  {agent.owner && (
                    <p className="text-[10px] text-muted-foreground mb-3">Owner: {agent.owner}</p>
                  )}

                  <div className="flex gap-1.5 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 px-2 bg-transparent"
                      onClick={() => calcRiskMutation.mutate({ agentId: agent.id })}
                      disabled={calcRiskMutation.isPending}
                    >
                      Recalculate Risk
                    </Button>
                    {agent.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 px-2 bg-transparent text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10"
                        onClick={() => updateStatusMutation.mutate({ id: agent.id, status: "suspended" })}
                      >
                        Suspend
                      </Button>
                    )}
                    {agent.status === "suspended" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 px-2 bg-transparent text-green-400 border-green-400/30 hover:bg-green-400/10"
                          onClick={() => updateStatusMutation.mutate({ id: agent.id, status: "active" })}
                        >
                          Reactivate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 px-2 bg-transparent text-red-400 border-red-400/30 hover:bg-red-400/10"
                          onClick={() => updateStatusMutation.mutate({ id: agent.id, status: "decommissioned" })}
                        >
                          Decommission
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AegisLayout>
  );
}
