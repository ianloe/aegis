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
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const EVENT_TYPES = [
  "data_access", "model_update", "api_call", "audit_log_access",
  "configuration_change", "personnel_access", "incident_report",
];

const eventTypeColor: Record<string, string> = {
  data_access: "text-red-400 border-red-400/30",
  model_update: "text-blue-400 border-blue-400/30",
  api_call: "text-green-400 border-green-400/30",
  audit_log_access: "text-orange-400 border-orange-400/30",
  configuration_change: "text-purple-400 border-purple-400/30",
  personnel_access: "text-yellow-400 border-yellow-400/30",
  incident_report: "text-red-400 border-red-400/30",
};

export default function VendorTransparency() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vendor: "", eventType: "data_access", personnelId: "",
    resourceAccessed: "", justification: "", region: "",
  });

  const { data: events, isLoading, refetch } = trpc.vendorTransparency.list.useQuery({ limit: 100 });
  const logMutation = trpc.vendorTransparency.ingest.useMutation({
    onSuccess: () => { toast.success("Vendor event logged"); setOpen(false); refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const vendors = Array.from(new Set((events ?? []).map((e) => e.vendor)));

  return (
    <AegisLayout title="Vendor Transparency">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Log and monitor vendor access events for transparency and accountability.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />Log Event</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="text-foreground">Log Vendor Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Vendor *</Label>
                    <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. OpenAI" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Event Type</Label>
                    <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
                      <SelectTrigger className="mt-1 bg-input border-border text-foreground text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {EVENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Personnel ID</Label>
                    <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. EMP-001" value={form.personnelId} onChange={(e) => setForm({ ...form, personnelId: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Region</Label>
                    <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. US-EAST, SG" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Resource Accessed</Label>
                  <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. /api/completions, training-data-bucket" value={form.resourceAccessed} onChange={(e) => setForm({ ...form, resourceAccessed: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Justification</Label>
                  <Textarea className="mt-1 bg-input border-border text-foreground resize-none" rows={2} placeholder="Why was this access necessary?" value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={() => {
                    if (!form.vendor.trim()) return toast.error("Vendor is required");
                    logMutation.mutate({
                      vendor: form.vendor,
                      eventType: form.eventType,
                      personnelId: form.personnelId || undefined,
                      resourceAccessed: form.resourceAccessed || undefined,
                      justification: form.justification || undefined,
                      region: form.region || undefined,
                    });
                  }} disabled={logMutation.isPending}>
                    {logMutation.isPending ? "Logging..." : "Log Event"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Vendor Summary */}
        {vendors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {vendors.map((v) => {
              const count = (events ?? []).filter((e) => e.vendor === v).length;
              return (
                <div key={v} className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-foreground">{v}</span>
                  <Badge variant="secondary" className="text-[9px]">{count}</Badge>
                </div>
              );
            })}
          </div>
        )}

        {/* Event Log */}
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)}</div>
        ) : (events ?? []).length === 0 ? (
          <Card className="glass-card border-border">
            <CardContent className="py-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No vendor events logged yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Log vendor access events to maintain transparency and accountability.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Timestamp</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Vendor</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Event Type</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Personnel</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Resource</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Region</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {(events ?? []).map((event) => (
                    <tr key={event.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{event.vendor}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[9px] ${eventTypeColor[event.eventType] ?? "text-muted-foreground"}`}>
                          {event.eventType.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{event.personnelId ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{event.resourceAccessed ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{event.region ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{event.justification ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AegisLayout>
  );
}
