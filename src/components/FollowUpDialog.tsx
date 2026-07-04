import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ComplaintWithDetails } from "@/hooks/useComplaints";
import { complaintsAPI, type FollowUp } from "@/integrations/firebase/complaintsAPI";
import { useAuth } from "@/context/AuthContext";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaint: ComplaintWithDetails | null;
  onSuccess?: () => void;
}

export default function FollowUpDialog({
  open,
  onOpenChange,
  complaint,
  onSuccess,
}: FollowUpDialogProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!complaint?.id) {
      toast.error("Complaint not found");
      return;
    }

    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    setIsLoading(true);
    try {
      const followUp: FollowUp = {
        addedBy: appUser?.id || "Unknown",
        addedByName: appUser?.fullName,
        timestamp: new Date().toISOString(),
        subject: subject.trim() || undefined,
        description: description.trim(),
      };

      await complaintsAPI.addFollowUp(complaint.id, followUp);

      toast.success("Follow-up added successfully");
      setSubject("");
      setDescription("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to add follow-up");
    } finally {
      setIsLoading(false);
    }
  };

  if (!complaint) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Follow-up</DialogTitle>
          <DialogDescription>
            Add a new issue or update to this ticket
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Complaint Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 font-semibold">Ticket Subject</p>
            <p className="text-sm text-blue-900 mt-1">{complaint.subject}</p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="font-semibold">
              Issue Subject (Optional)
            </Label>
            <Input
              id="subject"
              placeholder="Enter new issue subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isLoading}
              maxLength={200}
            />
            <p className="text-xs text-gray-500">{subject.length}/200</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="font-semibold">
              Description *
            </Label>
            <Textarea
              id="description"
              placeholder="Describe your follow-up or new issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={4}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">{description.length}/1000</p>
          </div>

          {/* Info */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Added by:</span> {appUser?.fullName || "Unknown"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <span className="font-semibold">Ticket Status:</span> {complaint.status}
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Follow-up"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
