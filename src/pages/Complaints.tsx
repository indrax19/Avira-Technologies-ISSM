import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { technicalProjectsAPI, type TechnicalProject } from "@/integrations/firebase/technicalProjectsAPI";
import { siteDetailsAPI, type SiteDetails } from "@/integrations/firebase/siteDetailsAPI";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { useAllComplaints, type ComplaintWithDetails } from "@/hooks/useComplaints";
import ComplaintsTable from "@/components/ComplaintsTable";
import { complaintsAPI, type Complaint, type ComplaintStatus } from "@/integrations/firebase/complaintsAPI";
import ComplaintStatusUpdateDialog from "@/components/ComplaintStatusUpdateDialog";

export default function Complaints() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();
  const [projects, setProjects] = useState<TechnicalProject[]>([]);
  const [allSites, setAllSites] = useState<SiteDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedComplaintForStatus, setSelectedComplaintForStatus] = useState<ComplaintWithDetails | null>(null);
  const [showStatusUpdateDialog, setShowStatusUpdateDialog] = useState(false);

  const [formData, setFormData] = useState({
    projectId: "",
    siteId: "",
    subject: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
  });

  const { complaints, isLoading: complaintsLoading } = useAllComplaints();
  const projectsUnsubRef = useRef<(() => void) | null>(null);
  const sitesUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setIsLoading(true);

    projectsUnsubRef.current = technicalProjectsAPI.subscribeAll(
      (projs) => {
        setProjects(projs);
      },
      (error) => {
        console.error("Failed to load projects:", error);
      }
    );

    const loadAllSites = async () => {
      try {
        const q = await siteDetailsAPI.getAll();
        setAllSites(q);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load sites:", error);
        setIsLoading(false);
      }
    };

    loadAllSites();

    return () => {
      projectsUnsubRef.current?.();
    };
  }, [appUser?.id]);

  // Filter projects based on user access (admin sees all, regular users see only assigned ones)
  const userAccessibleProjects = isAdmin
    ? projects
    : projects.filter((proj) =>
        proj.assignedUsers?.includes(appUser?.id || "") ||
        proj.assignedUsers?.includes(appUser?.email || "")
      );

  const filteredSites = formData.projectId
    ? allSites.filter((site) => site.technical_project_id === formData.projectId)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.projectId) {
      toast.error("Please select a project");
      return;
    }
    if (!formData.siteId) {
      toast.error("Please select a site");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Description is required");
      return;
    }

    try {
      const selectedDateTime = new Date(formData.date).toISOString();
      const newComplaint: Complaint = {
        projectId: formData.projectId,
        siteId: formData.siteId,
        subject: formData.subject,
        description: formData.description,
        date: formData.date,
        createdBy: appUser?.id || "Unknown",
        createdByName: appUser?.fullName,
        createdTime: selectedDateTime,
        status: "Open",
        statusHistory: [
          {
            status: "Open",
            updatedBy: appUser?.id || "Unknown",
            updatedByName: appUser?.fullName,
            timestamp: selectedDateTime,
            remarks: "Complaint created",
          },
        ],
      };

      await complaintsAPI.create(newComplaint);
      toast.success("Complaint added successfully");
      setFormData({
        projectId: "",
        siteId: "",
        subject: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
      });
      setShowAddDialog(false);
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to create complaint");
    }
  };

  // Filter complaints based on user's project access (admin sees all, regular users see only their project complaints)
  const userAccessibleComplaintsIds = new Set<string>();
  const userAccessibleProjectIds = new Set(
    isAdmin
      ? projects.map((p) => p.id)
      : userAccessibleProjects.map((p) => p.id)
  );

  const userVisibleComplaints = complaints.filter((complaint) =>
    isAdmin || userAccessibleProjectIds.has(complaint.projectId)
  );

  const openComplaints = userVisibleComplaints.filter((c) => c.status !== "Resolved").length;
  const resolvedComplaints = userVisibleComplaints.filter((c) => c.status === "Resolved").length;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading complaints...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                  className="h-10 w-10 rounded-xl bg-white/15 text-white hover:bg-white/25 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Badge className="border border-white/25 bg-white/15 text-white hover:bg-white/15">
                  Complaint Management
                </Badge>
              </div>

              <div>
                <h1 className="text-3xl font-bold md:text-4xl">Complaints & Issues</h1>
                <p className="mt-2 max-w-2xl text-sm text-blue-50 md:text-base">
                  Track, manage, and resolve all company complaints and issues across projects and sites.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowAddDialog(true)}
              className="w-full gap-2 bg-white text-blue-700 shadow-md hover:bg-blue-50 sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Add Complaint
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Complaints</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{userVisibleComplaints.length}</p>
              </div>
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
                <AlertCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-yellow-100 bg-gradient-to-br from-yellow-50 to-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Open Complaints</p>
                <p className="mt-2 text-3xl font-bold text-yellow-700">{openComplaints}</p>
              </div>
              <div className="rounded-2xl bg-yellow-100 p-3 text-yellow-600">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Resolved</p>
                <p className="mt-2 text-3xl font-bold text-emerald-700">{resolvedComplaints}</p>
              </div>
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-violet-100 bg-gradient-to-br from-violet-50 to-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Completion Rate</p>
                <p className="mt-2 text-3xl font-bold text-violet-700">
                  {userVisibleComplaints.length > 0 ? Math.round((resolvedComplaints / userVisibleComplaints.length) * 100) : 0}%
                </p>
              </div>
              <div className="rounded-2xl bg-violet-100 p-3 text-violet-600">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ComplaintsTable
        complaints={userVisibleComplaints}
        isLoading={complaintsLoading}
        currentUserId={appUser?.id}
        isAdmin={isAdmin}
        onStatusUpdateClick={(complaint) => {
          setSelectedComplaintForStatus(complaint);
          setShowStatusUpdateDialog(true);
        }}
      />

      {/* Add Complaint Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Complaint
            </DialogTitle>
            <DialogDescription>
              Create a new complaint with project, site, subject, and description details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project" className="font-semibold">
                Project *
              </Label>
              <Select value={formData.projectId} onValueChange={(value) => {
                setFormData({ ...formData, projectId: value, siteId: "" });
              }}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {userAccessibleProjects.length === 0 ? (
                    <div className="p-2 text-sm text-gray-600">
                      {isAdmin ? "No projects available" : "You don't have access to any projects yet"}
                    </div>
                  ) : (
                    userAccessibleProjects.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id || ""}>
                        {proj.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Site Selection */}
            <div className="space-y-2">
              <Label htmlFor="site" className="font-semibold">
                Site *
              </Label>
              <Select value={formData.siteId} onValueChange={(value) => {
                setFormData({ ...formData, siteId: value });
              }}>
                <SelectTrigger id="site">
                  <SelectValue placeholder={formData.projectId ? "Select a site" : "Please select a project first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredSites.length === 0 ? (
                    <div className="p-2 text-sm text-gray-600">
                      {formData.projectId ? "No sites for this project" : "Select a project first"}
                    </div>
                  ) : (
                    filteredSites.map((site) => (
                      <SelectItem key={site.id} value={site.id || ""}>
                        {site.millName || "Unnamed Site"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject" className="font-semibold">
                Subject *
              </Label>
              <Input
                id="subject"
                placeholder="Enter complaint subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                maxLength={200}
              />
              <p className="text-xs text-gray-500">{formData.subject.length}/200</p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-semibold">
                Description *
              </Label>
              <Textarea
                id="description"
                placeholder="Describe the complaint in detail..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                maxLength={1000}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">{formData.description.length}/1000</p>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date" className="font-semibold">
                Date *
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            {/* Info */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Created by:</span> {appUser?.fullName || "Unknown"}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                <span className="font-semibold">Status:</span> Open
              </p>
            </div>
          </form>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="border-slate-300 bg-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Create Complaint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <ComplaintStatusUpdateDialog
        open={showStatusUpdateDialog}
        onOpenChange={setShowStatusUpdateDialog}
        complaint={selectedComplaintForStatus}
        onSuccess={() => {
          setSelectedComplaintForStatus(null);
          queryClient.invalidateQueries({ queryKey: ["complaints"] });
        }}
      />
    </div>
  );
}
