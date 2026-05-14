import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle, Plus, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ShadowAI() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", vendor: "", category: "", notes: "" });

  const { data: tools, isLoading, refetch } = trpc.shadowAi.list.useQuery();
  const reportMutation = trpc.shadowAi.report.useMutation({
    onSuccess: () => { toast.success("Tool recorded"); setOpen(false); refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const sanctionMutation = trpc.shadowAi.sanction.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const sanctioned = (tools ?? []).filter((t) => t.sanctioned);
  const unsanctioned = (tools ?? []).filter((t) => !t.sanctioned);

  return (
    <AegisLayout title="Shadow AI Detection">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Track sanctioned and unsanctioned AI tools in use across your organisation.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />Report Tool</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="text-foreground">Report AI Tool</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Tool Name *</Label>
                  <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. ChatGPT, GitHub Copilot" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Vendor</Label>
                    <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. OpenAI" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. LLM, Code Assistant" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea className="mt-1 bg-input border-border text-foreground resize-none" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={() => {
                    if (!form.name.trim()) return toast.error("Tool name is required");
                    reportMutation.mutate({ name: form.name, vendor: form.vendor || undefined, category: form.category || undefined, notes: form.notes || undefined });
                  }} disabled={reportMutation.isPending}>
                    {reportMutation.isPending ? "Reporting..." : "Report Tool"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-green-400/20 bg-green-400/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-400">{sanctioned.length}</p>
                <p className="text-xs text-muted-foreground">Sanctioned Tools</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-400/20 bg-red-400/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-red-400">{unsanctioned.length}</p>
                <p className="text-xs text-muted-foreground">Unsanctioned Tools</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tool List */}
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
        ) : (tools ?? []).length === 0 ? (
          <Card className="glass-card border-border">
            <CardContent className="py-16 text-center">
              <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No AI tools recorded yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Report sanctioned and unsanctioned AI tools to track shadow AI usage.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {[...unsanctioned, ...sanctioned].map((tool) => (
              <Card key={tool.id} className={`border ${!tool.sanctioned ? "border-red-400/20 bg-red-400/3" : "glass-card border-border"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!tool.sanctioned ? "bg-red-400/10 border border-red-400/20" : "bg-green-400/10 border border-green-400/20"}`}>
                        {!tool.sanctioned ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle className="w-4 h-4 text-green-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-foreground">{tool.name}</p>
                          <Badge variant="outline" className={`text-[10px] ${tool.sanctioned ? "text-green-400 border-green-400/30 bg-green-400/5" : "text-red-400 border-red-400/30 bg-red-400/5"}`}>
                            {tool.sanctioned ? <><CheckCircle className="w-3 h-3 mr-1 inline" />Sanctioned</> : <><XCircle className="w-3 h-3 mr-1 inline" />Unsanctioned</>}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {tool.vendor && `${tool.vendor} · `}{tool.category && `${tool.category} · `}
                          {tool.detectedBy && `Detected by: ${tool.detectedBy} · `}
                          {new Date(tool.createdAt).toLocaleDateString("en-GB")}
                        </p>
                        {tool.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{tool.notes}</p>}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {tool.usageCount !== null && tool.usageCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">{tool.usageCount} uses</span>
                      )}
                      {!tool.sanctioned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-7 px-2 bg-transparent text-green-400 border-green-400/30 hover:bg-green-400/10"
                          onClick={() => sanctionMutation.mutate({ id: tool.id, sanctioned: true })}
                        >
                          Sanction
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-7 px-2 bg-transparent text-red-400 border-red-400/30 hover:bg-red-400/10"
                          onClick={() => sanctionMutation.mutate({ id: tool.id, sanctioned: false })}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
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
