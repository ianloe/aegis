import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, ClipboardList, Copy, Key, Pencil, Plus, RefreshCw, Shield, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

type DataTier = "benign" | "internal" | "sensitive";

interface AgentFormState {
  name: string;
  description: string;
  agentType: string;
  vendor: string;
  version: string;
  owner: string;
  maxDataTier: DataTier;
}

const EMPTY_FORM: AgentFormState = {
  name: "", description: "", agentType: "", vendor: "", version: "", owner: "",
  maxDataTier: "benign",
};

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

function AgentForm({
  form,
  onChange,
}: {
  form: AgentFormState;
  onChange: (f: AgentFormState) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Label className="text-xs text-muted-foreground">Agent Name *</Label>
        <Input
          className="mt-1 bg-input border-border text-foreground"
          placeholder="e.g. Customer Support Bot"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Agent Type</Label>
        <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. LLM, RAG, Agentic" value={form.agentType} onChange={(e) => onChange({ ...form, agentType: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Vendor</Label>
        <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. OpenAI, Anthropic" value={form.vendor} onChange={(e) => onChange({ ...form, vendor: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Version</Label>
        <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. 1.0.0" value={form.version} onChange={(e) => onChange({ ...form, version: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Owner</Label>
        <Input className="mt-1 bg-input border-border text-foreground" placeholder="Team or person" value={form.owner} onChange={(e) => onChange({ ...form, owner: e.target.value })} />
      </div>
      <div className="col-span-2">
        <Label className="text-xs text-muted-foreground">Max Data Tier</Label>
        <Select value={form.maxDataTier} onValueChange={(v) => onChange({ ...form, maxDataTier: v as DataTier })}>
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
        <Textarea className="mt-1 bg-input border-border text-foreground resize-none" rows={3} placeholder="What does this agent do?" value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} />
      </div>
    </div>
  );
}

export default function AgentRegistry() {
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AgentFormState>(EMPTY_FORM);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AgentFormState>(EMPTY_FORM);

  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [apiKeyAgentName, setApiKeyAgentName] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(null);
  const [apiKeyAgentId, setApiKeyAgentId] = useState<number | null>(null);

  const { data: agents, isLoading, refetch } = trpc.agents.list.useQuery();

  const createMutation = trpc.agents.create.useMutation({
    onSuccess: (agent) => {
      toast.success("Agent registered successfully");
      setCreateForm(EMPTY_FORM);
      setCreateOpen(false);
      if (agent?.apiKey) setNewApiKey(agent.apiKey);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.agents.update.useMutation({
    onSuccess: () => {
      toast.success("Agent updated");
      setEditOpen(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.agents.updateStatus.useMutation({
    onSuccess: () => { toast.success("Agent status updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const regenerateApiKeyMutation = trpc.agents.regenerateApiKey.useMutation({
    onSuccess: (data) => {
      setApiKeyValue(data.apiKey);
      toast.success("API key regenerated");
    },
    onError: (e) => toast.error(e.message),
  });

  const calcRiskMutation = trpc.riskScores.calculate.useMutation({
    onSuccess: (data) => { toast.success(`Risk score calculated: ${data.score.toFixed(1)}`); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!createForm.name.trim()) return toast.error("Agent name is required");
    createMutation.mutate(createForm);
  };

  const handleApiKeyOpen = (agent: NonNullable<typeof agents>[number]) => {
    setApiKeyAgentId(agent.id);
    setApiKeyAgentName(agent.name);
    setApiKeyValue(null); // don't show key until regenerated
    setApiKeyOpen(true);
  };

  const handleEditOpen = (agent: NonNullable<typeof agents>[number]) => {
    setEditId(agent.id);
    setEditForm({
      name: agent.name,
      description: agent.description ?? "",
      agentType: agent.agentType ?? "",
      vendor: agent.vendor ?? "",
      version: agent.version ?? "",
      owner: agent.owner ?? "",
      maxDataTier: (agent.maxDataTier as DataTier) ?? "benign",
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editForm.name.trim()) return toast.error("Agent name is required");
    if (editId === null) return;
    updateMutation.mutate({ id: editId, ...editForm });
  };

  return (
    <AegisLayout title="Agent Registry">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage and monitor all registered AI agents across your organisation.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                  <AgentForm form={createForm} onChange={setCreateForm} />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Registering..." : "Register Agent"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* API Key reveal dialog shown once after creation */}
        <Dialog open={!!newApiKey} onOpenChange={(o) => { if (!o) setNewApiKey(null); }}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Agent API Key</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Copy this key now — it will not be shown again. Use it in the <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer</code> header when sending audit logs to <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/ingest/audit-log</code>.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted border border-border rounded px-3 py-2 break-all font-mono text-foreground">
                  {newApiKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(newApiKey ?? "");
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={() => setNewApiKey(null)}>Done</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* API Key Management dialog */}
        <Dialog open={apiKeyOpen} onOpenChange={setApiKeyOpen}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">API Key — {apiKeyAgentName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Use this key in the <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer</code> header
                when sending audit logs to <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/ingest/audit-log</code>.
              </p>

              {apiKeyValue ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted border border-border rounded px-3 py-2 break-all font-mono text-foreground">
                    {apiKeyValue}
                  </code>
                  <Button variant="outline" size="sm" className="bg-transparent shrink-0"
                    onClick={() => { navigator.clipboard.writeText(apiKeyValue); toast.success("Copied"); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  The key is not displayed for security. Click <strong>Regenerate</strong> to issue a new one.
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">Log Ingestion — Sample Request</p>
                <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap">{`curl -X POST https://aegis.ianloehome.net/api/ingest/audit-log \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <your-api-key>" \\\n  -d '{
    "actionType": "api_call",
    "summary": "Called external payment API",
    "dataTier": "sensitive",
    "userName": "service-account"
  }'`}</pre>
                <p className="text-[10px] text-muted-foreground">Supported actionTypes: prompt_sent, response_received, file_read, file_write, api_call, email_sent, financial_transaction, login, logout, policy_change, anomaly_detected</p>
              </div>

              <div className="flex justify-between items-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10"
                  onClick={() => apiKeyAgentId !== null && regenerateApiKeyMutation.mutate({ id: apiKeyAgentId })}
                  disabled={regenerateApiKeyMutation.isPending}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  {regenerateApiKeyMutation.isPending ? "Regenerating..." : "Regenerate Key"}
                </Button>
                <Button size="sm" onClick={() => setApiKeyOpen(false)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Agent dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit Agent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <AgentForm form={editForm} onChange={setEditForm} />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                    <Link href={`/agents/${agent.id}/aaef`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 px-2 bg-transparent text-purple-400 border-purple-400/30 hover:bg-purple-400/10"
                      >
                        <ClipboardList className="w-3 h-3 mr-1" />
                        AAEF
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 px-2 bg-transparent"
                      onClick={() => handleEditOpen(agent)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 px-2 bg-transparent"
                      onClick={() => handleApiKeyOpen(agent)}
                    >
                      <Key className="w-3 h-3 mr-1" />
                      API Key
                    </Button>
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
