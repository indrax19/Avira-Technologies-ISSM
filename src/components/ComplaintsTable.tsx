import { useState, useEffect, Fragment } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { AlertCircle, Edit2, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import StatusHistoryPanel from "./StatusHistoryPanel";
import { toast } from "sonner";
import { ComplaintWithDetails } from "@/hooks/useComplaints";
import { complaintsAPI, type ComplaintStatus } from "@/integrations/firebase/complaintsAPI";
import { usersAPI, type User } from "@/integrations/firebase/usersAPI";
import { format } from "date-fns";
import { STATUS_COLORS } from "@/lib/colors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ComplaintsTableProps {
  complaints: ComplaintWithDetails[];
  isLoading: boolean;
  onStatusUpdateClick?: (complaint: ComplaintWithDetails) => void;
  currentUserId?: string;
  isAdmin?: boolean;
}

type StatusFilter = "All" | ComplaintStatus;

const STATUS_MAPPING: Record<ComplaintStatus, keyof typeof STATUS_COLORS> = {
  "Open": "open",
  "In Progress": "in-progress",
  "Pending": "pending",
  "On Hold": "on-hold",
  "Resolved": "resolved",
};

const STATUS_OPTIONS: { value: ComplaintStatus; label: string }[] = [
  { value: "Open", label: "Open" },
  { value: "In Progress", label: "In Progress" },
  { value: "Pending", label: "Pending" },
  { value: "On Hold", label: "On Hold" },
  { value: "Resolved", label: "Resolved" },
];

export default function ComplaintsTable({
  complaints,
  isLoading,
  onStatusUpdateClick,
  currentUserId,
  isAdmin,
}: ComplaintsTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Record<string, User | null>>({});
  const [expandedComplaintId, setExpandedComplaintId] = useState<string | null>(null);

  const getLastUpdateUser = (complaint: ComplaintWithDetails): { name: string; timestamp: string } | null => {
    if (!complaint.statusHistory || complaint.statusHistory.length === 0) {
      return null;
    }
    const lastEntry = complaint.statusHistory[complaint.statusHistory.length - 1];
    return {
      name: lastEntry.updatedByName || getUserName(lastEntry.updatedBy),
      timestamp: lastEntry.timestamp,
    };
  };

  useEffect(() => {
    let isMounted = true;

    const fetchUserNames = async () => {
      try {
        const userIds = new Set<string>();
        complaints.forEach((complaint) => {
          if (complaint.createdBy) userIds.add(complaint.createdBy);
          if (complaint.resolvedBy) userIds.add(complaint.resolvedBy);
        });

        const newUserMap: Record<string, User | null> = {};
        for (const userId of userIds) {
          if (!userMap[userId]) {
            try {
              const user = await usersAPI.getById(userId);
              if (isMounted) {
                newUserMap[userId] = user;
              } else {
                return;
              }
            } catch (error: any) {
              if (error.name === "AbortError" || error.code === "aborted") {
                return;
              }
              console.error(`Failed to fetch user ${userId}:`, error);
              if (isMounted) {
                newUserMap[userId] = null;
              }
            }
          }
        }

        if (isMounted && Object.keys(newUserMap).length > 0) {
          setUserMap((prev) => ({ ...prev, ...newUserMap }));
        }
      } catch (error: any) {
        if (error.name !== "AbortError" && error.code !== "aborted") {
          console.error("Error in fetchUserNames:", error);
        }
      }
    };

    fetchUserNames();

    return () => {
      isMounted = false;
    };
  }, [complaints]);

  const filteredComplaints = statusFilter === "All"
    ? complaints
    : complaints.filter((complaint) => complaint.status === statusFilter);

  const canDeleteComplaint = (complaint: ComplaintWithDetails): boolean => {
    if (isAdmin) return true;
    return complaint.createdBy === currentUserId;
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await complaintsAPI.delete(id);
      toast.success("Complaint deleted successfully");
      setDeleteConfirmId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete complaint");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    const colorKey = STATUS_MAPPING[status];
    const colorConfig = colorKey ? STATUS_COLORS[colorKey] : null;
    const option = STATUS_OPTIONS.find((opt) => opt.value === status);

    if (!option || !colorConfig) {
      return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }

    return (
      <Badge className={colorConfig.badge}>
        <AlertCircle className="mr-1 h-3 w-3" />
        {option.label}
      </Badge>
    );
  };

  const getUserName = (userId?: string) => {
    if (!userId) return "—";
    return userMap[userId]?.fullName || userId || "—";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (complaints.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <p className="text-gray-600">No complaints found yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="text-sm font-semibold text-gray-700">Filter by Status:</span>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Complaints ({complaints.length})</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} ({complaints.filter((c) => c.status === option.value).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredComplaints.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-600">No {statusFilter.toLowerCase()} complaints found</p>
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredComplaints.map((complaint) => {
              const isExpanded = expandedComplaintId === complaint.id;
              return (
                <Card key={complaint.id} className="border border-slate-200 shadow-sm">
                  <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => setExpandedComplaintId(isExpanded ? null : complaint.id!)}
                        className="min-w-0 flex-1 text-left space-y-2 hover:opacity-75 transition-opacity"
                      >
                        <div className="flex items-start gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                          )}
                          <p className="font-semibold text-slate-900 break-words flex-1">{complaint.subject}</p>
                        </div>
                        <p className="text-sm text-slate-600 break-words">{complaint.description}</p>
                      </button>
                      {getStatusBadge(complaint.status)}
                    </div>

                    <div className="rounded-lg bg-slate-50 p-3 space-y-2 text-sm">
                      <p className="text-slate-600">
                        <span className="font-semibold">Project:</span> {complaint.projectName}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-semibold">Site:</span> {complaint.siteName}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-semibold">Created:</span> {format(new Date(complaint.createdTime), "MMM dd, yyyy")}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-semibold">By:</span> {getUserName(complaint.createdBy)}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-semibold">Last Update By:</span> {getLastUpdateUser(complaint)?.name || "—"}
                      </p>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 pt-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Status History</p>
                        <StatusHistoryPanel
                          statusHistory={complaint.statusHistory}
                          currentStatus={complaint.status}
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {complaint.status !== "Resolved" && onStatusUpdateClick && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onStatusUpdateClick(complaint)}
                          className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <AlertCircle className="h-4 w-4" />
                          Update Status
                        </Button>
                      )}
                      {canDeleteComplaint(complaint) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirmId(complaint.id || "")}
                          className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-lg border bg-white md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Subject</TableHead>
                    <TableHead className="font-semibold">Project</TableHead>
                    <TableHead className="font-semibold">Site</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="font-semibold">Created By</TableHead>
                    <TableHead className="font-semibold">Last Update By</TableHead>
                    <TableHead className="font-semibold">Resolved By</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComplaints.map((complaint) => {
                    const isExpanded = expandedComplaintId === complaint.id;
                    return (
                      <Fragment key={complaint.id}>
                        <TableRow className="hover:bg-gray-50">
                          <TableCell>
                            <button
                              onClick={() => setExpandedComplaintId(isExpanded ? null : complaint.id!)}
                              className="w-full text-left hover:opacity-75 transition-opacity max-w-sm space-y-1 xl:max-w-md"
                            >
                              <div className="flex items-start gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                                )}
                                <p className="font-medium text-gray-900 break-words flex-1">{complaint.subject}</p>
                              </div>
                              <p className="text-xs leading-5 text-gray-500 whitespace-pre-wrap break-words">
                                {complaint.description}
                              </p>
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">{complaint.projectName}</TableCell>
                          <TableCell className="text-sm text-gray-700">{complaint.siteName}</TableCell>
                          <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {format(new Date(complaint.createdTime), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">{getUserName(complaint.createdBy)}</TableCell>
                          <TableCell className="text-sm text-gray-700">
                            {getLastUpdateUser(complaint)?.name || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">{getUserName(complaint.resolvedBy)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {complaint.status !== "Resolved" && onStatusUpdateClick && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onStatusUpdateClick(complaint)}
                                  className="h-8 w-8 p-0 hover:bg-blue-100"
                                  title="Update Status"
                                >
                                  <AlertCircle className="h-4 w-4 text-blue-600" />
                                </Button>
                              )}
                              {canDeleteComplaint(complaint) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteConfirmId(complaint.id || "")}
                                  className="h-8 w-8 p-0 hover:bg-red-100"
                                  title="Delete Complaint"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableCell colSpan={9} className="p-4">
                              <div className="space-y-3">
                                <p className="text-sm font-semibold text-gray-700">Status History & Timeline</p>
                                <StatusHistoryPanel
                                  statusHistory={complaint.statusHistory}
                                  currentStatus={complaint.status}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Complaint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this complaint? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={!!deletingId}
              className="gap-2 bg-red-600 hover:bg-red-700"
            >
              {deletingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
