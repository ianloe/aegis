import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Bell, CheckCheck, Info, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <XCircle className="w-4 h-4 text-red-400" />;
  if (severity === "warning") return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  if (severity === "info") return <Info className="w-4 h-4 text-blue-400" />;
  return <Bell className="w-4 h-4 text-muted-foreground" />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "text-red-400 border-red-400/30 bg-red-400/5",
    warning: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    info: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  };
  return <Badge variant="outline" className={`text-[10px] capitalize ${styles[severity] ?? ""}`}>{severity}</Badge>;
}

export default function Notifications() {
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery({});
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { toast.success("All notifications marked as read"); refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const unread = (notifications ?? []).filter((n) => !n.read);

  return (
    <AegisLayout title="Notifications">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Security alerts, policy violations, and system notifications.</p>
            {unread.length > 0 && (
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">{unread.length} unread</Badge>
            )}
          </div>
          {unread.length > 0 && (
            <Button size="sm" variant="outline" className="bg-transparent" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              Mark All Read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
        ) : (notifications ?? []).length === 0 ? (
          <Card className="glass-card border-border">
            <CardContent className="py-16 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Alerts will appear here when policy violations or anomalies are detected.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(notifications ?? []).map((n) => (
              <Card
                key={n.id}
                className={`border transition-all ${!n.read ? "border-primary/20 bg-primary/3" : "glass-card border-border opacity-70"}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      n.severity === "critical" ? "bg-red-400/10 border border-red-400/20" :
                      n.severity === "warning" ? "bg-yellow-400/10 border border-yellow-400/20" :
                      "bg-blue-400/10 border border-blue-400/20"
                    }`}>
                      <SeverityIcon severity={n.severity} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                        <SeverityBadge severity={n.severity} />
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-muted-foreground/60">
                          {new Date(n.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {n.type && ` · ${n.type.replace(/_/g, " ")}`}
                        </p>
                        {!n.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() => markReadMutation.mutate({ id: n.id })}
                          >
                            Mark read
                          </Button>
                        )}
                      </div>
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
