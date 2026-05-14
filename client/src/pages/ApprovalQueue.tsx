import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle, ClipboardCheck, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const categoryConfig: Record<string, { label: string; color: string }> = {
  data_deletion: { label: "Data Deletion", color: "text-red-400" },
  external_communications: { label: "External Communications", color: "text-orange-400" },
  financial_transactions: { label: "Financial Transactions", color: "text-yellow-400" },
  privilege_escalation: { label: "Privilege Escalation", color: "text-purple-400" },
  bulk_export: { label: "Bulk Export", color: "text-blue-400" },
};

const tierBadge = (tier: string | null) => {
  if (!tier) return null;
  const styles: Record<string, string> = {
    benign: "text-green-400 border-green-400/30",
    internal: "text-yellow-400 border-yellow-400/30",
    sensitive: "text-red-400 border-red-400/30",
  };
  return <Badge variant="outline" className={`text-[9px] capitalize ${styles[tier] ?? ""}`}>{tier}</Badge>;
};

export default function ApprovalQueue() {
  const [reviewItem, setReviewItem] = useState<{ id: number; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const { data: pending, refetch: refetchPending } = trpc.approvals.list.useQuery({ status: "pending" });
  const { data: approved, refetch: refetchApproved } = trpc.approvals.list.useQuery({ status: "approved" });
  const { data: rejected, refetch: refetchRejected } = trpc.approvals.list.useQuery({ status: "rejected" });

  const reviewMutation = trpc.approvals.review.useMutation({
    onSuccess: () => {
      toast.success(`Request ${reviewItem?.decision}`);
      setReviewItem(null);
      setNote("");
      refetchPending();
      refetchApproved();
      refetchRejected();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleReview = () => {
    if (!reviewItem) return;
    reviewMutation.mutate({ id: reviewItem.id, decision: reviewItem.decision, note: note || undefined });
  };

  const ApprovalCard = ({ item, showActions }: { item: NonNullable<typeof pending>[0]; showActions: boolean }) => {
    const cat = categoryConfig[item.actionCategory];
    return (
      <Card className="glass-card border-border">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-foreground">{item.agentName ?? `Agent #${item.agentId}`}</p>
                {tierBadge(item.dataTier)}
              </div>
              <p className={`text-xs font-medium ${cat?.color ?? "text-muted-foreground"}`}>{cat?.label ?? item.actionCategory}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">Requested by</p>
              <p className="text-xs text-foreground">{item.requestedBy ?? "Unknown"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(item.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{item.actionDescription}</p>
          {item.reviewNote && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 mb-3">
              <span className="font-medium text-foreground">Review note: </span>{item.reviewNote}
            </div>
          )}
          {showActions && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                variant="outline"
                onClick={() => setReviewItem({ id: item.id, decision: "approved" })}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Approve
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                variant="outline"
                onClick={() => setReviewItem({ id: item.id, decision: "rejected" })}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Reject
              </Button>
            </div>
          )}
          {!showActions && (
            <div className={`flex items-center gap-1.5 text-xs ${item.status === "approved" ? "text-green-400" : "text-red-400"}`}>
              {item.status === "approved" ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {item.status === "approved" ? "Approved" : "Rejected"} by {item.reviewedBy ?? "Unknown"}
              {item.reviewedAt && ` · ${new Date(item.reviewedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AegisLayout title="Approval Queue">
      <div className="p-6 space-y-5">
        <p className="text-sm text-muted-foreground">Review and approve high-risk agent actions before they are executed.</p>

        {/* High-risk categories info */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(categoryConfig).map(([key, cfg]) => (
            <div key={key} className="glass-card rounded-lg p-3 text-center">
              <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="bg-muted/30 border border-border">
            <TabsTrigger value="pending" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Pending ({pending?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs data-[state=active]:bg-green-400/20 data-[state=active]:text-green-400">
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              Approved ({approved?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs data-[state=active]:bg-red-400/20 data-[state=active]:text-red-400">
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Rejected ({rejected?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pending?.length === 0 ? (
              <Card className="glass-card border-border">
                <CardContent className="py-16 text-center">
                  <ClipboardCheck className="w-12 h-12 text-green-400/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No pending approvals</p>
                  <p className="text-xs text-muted-foreground mt-1">All high-risk actions have been reviewed.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pending?.map((item) => <ApprovalCard key={item.id} item={item} showActions={true} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approved?.map((item) => <ApprovalCard key={item.id} item={item} showActions={false} />)}
            </div>
          </TabsContent>

          <TabsContent value="rejected" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rejected?.map((item) => <ApprovalCard key={item.id} item={item} showActions={false} />)}
            </div>
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={!!reviewItem} onOpenChange={() => { setReviewItem(null); setNote(""); }}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className={`text-foreground ${reviewItem?.decision === "approved" ? "text-green-400" : "text-red-400"}`}>
                {reviewItem?.decision === "approved" ? "Approve" : "Reject"} Request
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                {reviewItem?.decision === "approved"
                  ? "Approving this request will allow the agent to proceed with the high-risk action."
                  : "Rejecting this request will block the agent from proceeding with the high-risk action."}
              </p>
              <div>
                <Label className="text-xs text-muted-foreground">Review Note (optional)</Label>
                <Textarea
                  className="mt-1 bg-input border-border text-foreground resize-none"
                  rows={3}
                  placeholder="Add a note explaining your decision..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => { setReviewItem(null); setNote(""); }}>Cancel</Button>
                <Button
                  size="sm"
                  className={reviewItem?.decision === "approved" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}
                  onClick={handleReview}
                  disabled={reviewMutation.isPending}
                >
                  {reviewMutation.isPending ? "Processing..." : reviewItem?.decision === "approved" ? "Confirm Approval" : "Confirm Rejection"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AegisLayout>
  );
}
