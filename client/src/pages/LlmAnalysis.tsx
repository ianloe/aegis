import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Brain, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "text-red-400 border-red-400/30 bg-red-400/5",
    high: "text-orange-400 border-orange-400/30 bg-orange-400/5",
    medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    low: "text-green-400 border-green-400/30 bg-green-400/5",
    info: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  };
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${styles[severity] ?? ""}`}>{severity}</Badge>
  );
}

export default function LlmAnalysis() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");

  const { data: agents } = trpc.agents.list.useQuery();
  const { data: analyses, isLoading, refetch } = trpc.llmAnalysis.list.useQuery({
    agentId: selectedAgentId !== "all" ? parseInt(selectedAgentId) : undefined,
  });

  const analyzeMutation = trpc.llmAnalysis.analyse.useMutation({
    onSuccess: () => { toast.success("Analysis complete"); refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const handleAnalyze = () => {
    if (selectedAgentId === "all") {
      (agents ?? []).forEach((a) => analyzeMutation.mutate({ agentId: a.id, analysisType: "log_analysis" as const }));
    } else {
      analyzeMutation.mutate({ agentId: parseInt(selectedAgentId), analysisType: "log_analysis" as const });
    }
  };

  return (
    <AegisLayout title="LLM Log Analysis">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            AI-powered analysis of agent logs — flags suspicious patterns and generates plain-English risk summaries with remediation guidance.
          </p>
          <div className="flex items-center gap-2">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="w-48 h-9 bg-input border-border text-foreground text-xs">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Agents</SelectItem>
                {(agents ?? []).map((a) => (
                  <SelectItem key={a.id} value={String(a.id)} className="text-xs">{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAnalyze} disabled={analyzeMutation.isPending}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              {analyzeMutation.isPending ? "Analysing..." : "Run Analysis"}
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Analysis Results */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 rounded-xl shimmer" />)}
          </div>
        ) : (analyses ?? []).length === 0 ? (
          <Card className="glass-card border-border">
            <CardContent className="py-16 text-center">
              <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No analyses yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Select an agent and run an analysis to see AI-generated risk summaries.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(analyses ?? []).map((analysis) => {
              const flags = analysis.flaggedPatterns as string[] | null;
              const remediations = analysis.remediationActions as string[] | null;
              return (
                <Card key={analysis.id} className="glass-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Brain className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm text-foreground">
                            Agent #{analysis.agentId} Analysis
                          </CardTitle>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(analysis.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            {analysis.inputSummary && ` · ${analysis.inputSummary}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">{analysis.analysisType.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Summary */}
                    <div>
                      <p className="text-xs font-medium text-foreground mb-2">Risk Summary</p>
                      <div className="text-xs text-muted-foreground leading-relaxed prose prose-invert prose-sm max-w-none">
                        <Streamdown>{analysis.result}</Streamdown>
                      </div>
                    </div>

                    {/* Flags */}
                    {flags && flags.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-2">Suspicious Patterns Detected</p>
                        <div className="space-y-1.5">
                          {flags.map((flag, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                              {flag}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Remediations */}
                    {remediations && remediations.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-2">Recommended Actions</p>
                        <div className="space-y-1.5">
                          {remediations.map((r, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-green-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                              {r}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AegisLayout>
  );
}
