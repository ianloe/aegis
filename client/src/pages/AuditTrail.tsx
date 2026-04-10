import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Download, Eye, Filter, Hash, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ACTION_TYPES = [
  "prompt_sent", "response_received", "file_read", "file_write", "file_delete",
  "api_call", "email_sent", "financial_transaction", "login", "logout",
  "policy_change", "agent_registered", "agent_suspended", "agent_decommissioned",
  "approval_requested", "approval_granted", "approval_rejected", "anomaly_detected",
];

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const styles: Record<string, string> = {
    benign: "text-green-400 border-green-400/30 bg-green-400/5",
    internal: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    sensitive: "text-red-400 border-red-400/30 bg-red-400/5",
  };
  return <Badge variant="outline" className={`text-[9px] capitalize ${styles[tier] ?? ""}`}>{tier}</Badge>;
}

export default function AuditTrail() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const { data, isLoading, refetch } = trpc.auditLogs.list.useQuery({
    search: search || undefined,
    actionType: actionFilter !== "all" ? actionFilter : undefined,
    dataTier: tierFilter !== "all" ? tierFilter : undefined,
    flagged: flaggedOnly || undefined,
    limit: LIMIT,
    offset,
  });

  const exportMutation = trpc.auditLogs.export.useMutation({
    onSuccess: (result) => {
      toast.success("Export ready");
      window.open(result.url, "_blank");
    },
    onError: (e) => toast.error(e.message),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <AegisLayout title="Audit Trail">
      <div className="p-6 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-9 bg-input border-border text-foreground text-sm h-9"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setOffset(0); }}>
            <SelectTrigger className="w-44 h-9 bg-input border-border text-foreground text-xs">
              <Filter className="w-3 h-3 mr-1.5" />
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Actions</SelectItem>
              {ACTION_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setOffset(0); }}>
            <SelectTrigger className="w-36 h-9 bg-input border-border text-foreground text-xs">
              <SelectValue placeholder="Data tier" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="benign">Benign</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="sensitive">Sensitive</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={flaggedOnly ? "default" : "outline"}
            size="sm"
            className={`h-9 text-xs ${!flaggedOnly ? "bg-transparent" : ""}`}
            onClick={() => { setFlaggedOnly(!flaggedOnly); setOffset(0); }}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Flagged Only
          </Button>
          <Button variant="outline" size="sm" className="h-9 bg-transparent" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-9 bg-transparent" onClick={() => exportMutation.mutate({ limit: 500 })} disabled={exportMutation.isPending}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />{total.toLocaleString()} total entries</span>
          {flaggedOnly && <Badge variant="outline" className="text-red-400 border-red-400/30 text-[10px]">Showing flagged only</Badge>}
        </div>

        {/* Log Table */}
        <Card className="glass-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium w-8">#</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Timestamp</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Agent</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Tier</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Summary</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Hash</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium w-16">Flag</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="h-4 rounded shimmer" />
                      </td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No audit log entries found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={String(log.id)} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${log.flagged ? "bg-red-400/3" : ""}`}>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{String(log.id).slice(-4)}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-foreground">{log.agentName ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[9px] font-mono">{log.actionType.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-4 py-3"><TierBadge tier={log.dataTier} /></td>
                      <td className="px-4 py-3 text-foreground max-w-xs truncate">{log.summary}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground text-[9px]">
                        {log.entryHash ? (
                          <span title={log.entryHash} className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {log.entryHash.slice(0, 8)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.flagged && <AlertTriangle className="w-3.5 h-3.5 text-red-400 mx-auto" />}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs bg-transparent" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>Previous</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-transparent" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </AegisLayout>
  );
}
