import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import SiteSelectDropdown from "@/components/SiteSelectDropdown";
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
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  X,
  TrendingUp,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { useAllComplaints, type ComplaintWithDetails } from "@/hooks/useComplaints";
import ComplaintsTable from "@/components/ComplaintsTable";
import { complaintsAPI, type Complaint, type ComplaintStatus } from "@/integrations/firebase/complaintsAPI";
import ComplaintStatusUpdateDialog from "@/components/ComplaintStatusUpdateDialog";
import FollowUpDialog from "@/components/FollowUpDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type IssueType = "Camera Disconnected" | "AnyDesk Issue" | "Site Offline" | "Internet Issue" | "Other";

const issueTypes: IssueType[] = ["Camera Disconnected", "AnyDesk Issue", "Site Offline", "Internet Issue", "Other"];
const complaintSubjectOptions = [
  "Camera Disconnected",
  "AnyDesk Issue",
  "Site Offline",
  "Internet Issue",
  "System Performance Issue",
  "Access or Login Issue",
];

function getIssueType(complaint: ComplaintWithDetails): IssueType {
  const text = `${complaint.subject} ${complaint.description}`.toLowerCase();
  if (text.includes("camera") || text.includes("nvr") || text.includes("cctv")) return "Camera Disconnected";
  if (text.includes("anydesk") || text.includes("remote desktop") || text.includes("rustdesk")) return "AnyDesk Issue";
  if (text.includes("offline") || text.includes("site down") || text.includes("site is down")) return "Site Offline";
  if (text.includes("internet") || text.includes("network") || text.includes("wifi") || text.includes("wi-fi")) return "Internet Issue";
  return "Other";
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

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
  const [selectedComplaintForFollowUp, setSelectedComplaintForFollowUp] = useState<ComplaintWithDetails | null>(null);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [showExistingTicketDialog, setShowExistingTicketDialog] = useState(false);
  const [existingTicketDetails, setExistingTicketDetails] = useState<ComplaintWithDetails | null>(null);
  const [reportFilters, setReportFilters] = useState({ date: "", site: "all", issueType: "all", status: "all" });
  const [subjectMode, setSubjectMode] = useState<"preset" | "custom">("preset");
  const [reportDrilldown, setReportDrilldown] = useState<{ title: string; rows: ComplaintWithDetails[] } | null>(null);

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
      // Check for existing open tickets on the same site
      const existingOpenTickets = await complaintsAPI.getOpenComplaintsBySite(formData.siteId);

      if (existingOpenTickets.length > 0) {
        const existingTicket = complaints.find((c) => c.id === existingOpenTickets[0].id);
        if (existingTicket) {
          setExistingTicketDetails(existingTicket);
          setShowExistingTicketDialog(true);
        } else {
          toast.error(
            `Cannot create new ticket. There is already an open ticket for this site. Please resolve the existing ticket first.`
          );
        }
        return;
      }

      const currentDateTime = new Date().toISOString();
      const newComplaint: Complaint = {
        projectId: formData.projectId,
        siteId: formData.siteId,
        subject: formData.subject,
        description: formData.description,
        date: formData.date,
        createdBy: appUser?.id || "Unknown",
        createdByName: appUser?.fullName,
        createdTime: currentDateTime,
        status: "Open",
        statusHistory: [
          {
            status: "Open",
            updatedBy: appUser?.id || "Unknown",
            updatedByName: appUser?.fullName,
            timestamp: currentDateTime,
            remarks: "Complaint created",
          },
        ],
        followUps: [],
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
      setSubjectMode("preset");
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

  const reportRows = useMemo(() => userVisibleComplaints.map((complaint) => ({
    complaint,
    issueType: getIssueType(complaint),
  })), [userVisibleComplaints]);

  const filteredReportRows = useMemo(() => reportRows.filter(({ complaint, issueType }) => (
    (!reportFilters.date || complaint.date === reportFilters.date || complaint.createdTime.startsWith(reportFilters.date)) &&
    (reportFilters.site === "all" || complaint.siteName === reportFilters.site) &&
    (reportFilters.issueType === "all" || issueType === reportFilters.issueType) &&
    (reportFilters.status === "all" || complaint.status === reportFilters.status)
  )), [reportRows, reportFilters]);

  const issueCounts = issueTypes.map((type) => ({
    type,
    count: filteredReportRows.filter((row) => row.issueType === type).length,
  }));
  const siteCounts = filteredReportRows.reduce<Record<string, number>>((counts, { complaint }) => {
    const site = complaint.siteName || "Unknown site";
    counts[site] = (counts[site] || 0) + 1;
    return counts;
  }, {});
  const problematicSites = Object.entries(siteCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 7);
  const repeatedIssues = Object.entries(filteredReportRows
    .filter(({ complaint }) => new Date(complaint.createdTime || complaint.date).getTime() >= recentCutoff.getTime())
    .reduce<Record<string, number>>((counts, { complaint, issueType }) => {
      const key = `${complaint.siteName || "Unknown site"}|${issueType}`;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {}))
    .filter(([, count]) => count > 1)
    .sort(([, a], [, b]) => b - a);

  const exportRows = filteredReportRows.map(({ complaint, issueType }) => [
    complaint.siteName || "Unknown site",
    issueType,
    complaint.subject,
    complaint.status,
    complaint.date,
  ]);

  const exportReport = (format: "xlsx" | "csv" | "pdf") => {
    const headers = ["Site", "Issue Type", "Subject", "Status", "Date"];
    const filename = `issue-report-${new Date().toISOString().split("T")[0]}`;
    if (format === "xlsx") {
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Issue Report");
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    } else if (format === "csv") {
      const csv = [headers, ...exportRows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\\n");
      downloadBlob(csv, `${filename}.csv`, "text/csv;charset=utf-8");
    } else {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("Issue Reporting", 14, 16);
      autoTable(doc, { head: [headers], body: exportRows, startY: 24, styles: { fontSize: 8 } });
      doc.save(`${filename}.pdf`);
    }
    toast.success(`${format.toUpperCase()} report downloaded`);
  };

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
                  Support Tickets
                </Badge>
              </div>

              <div>
                <h1 className="text-3xl font-bold md:text-4xl">Support Tickets</h1>
                <p className="mt-2 max-w-2xl text-sm text-blue-50 md:text-base">
                  Track, manage, and resolve all company support tickets across projects and sites.
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

      {isAdmin && (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="gap-4 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <TrendingUp className="h-5 w-5 text-blue-600" /> Issue Reporting
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">Understand issue trends, repeat tickets, and the sites that need attention.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportReport("xlsx")}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportReport("csv")}>
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportReport("pdf")}>
                <FileText className="h-4 w-4 text-red-600" /> PDF
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> Date</Label>
              <Input type="date" value={reportFilters.date} onChange={(e) => setReportFilters({ ...reportFilters, date: e.target.value })} className="bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> Site</Label>
              <Select value={reportFilters.site} onValueChange={(site) => setReportFilters({ ...reportFilters, site })}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="All sites" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {[...new Set(userVisibleComplaints.map((complaint) => complaint.siteName || "Unknown site"))].sort().map((site) => <SelectItem key={site} value={site}>{site}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-slate-500"><Filter className="h-3.5 w-3.5" /> Issue Type</Label>
              <Select value={reportFilters.issueType} onValueChange={(issueType) => setReportFilters({ ...reportFilters, issueType })}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="All issue types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All issue types</SelectItem>
                  {issueTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Status</Label>
              <Select value={reportFilters.status} onValueChange={(status) => setReportFilters({ ...reportFilters, status })}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {(["Open", "In Progress", "Waiting for Response", "Pending", "On Hold", "Resolved"] as ComplaintStatus[]).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(reportFilters.date || reportFilters.site !== "all" || reportFilters.issueType !== "all" || reportFilters.status !== "all") && (
            <Button variant="ghost" size="sm" className="w-fit gap-2 text-slate-500" onClick={() => setReportFilters({ date: "", site: "all", issueType: "all", status: "all" })}>
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-slate-900">Issues by type</h3><span className="text-xs text-slate-500">{filteredReportRows.length} matching</span></div>
              <div className="space-y-3">
                {issueCounts.map(({ type, count }) => {
                  const percentage = filteredReportRows.length ? Math.round((count / filteredReportRows.length) * 100) : 0;
                  return <button key={type} type="button" className="block w-full space-y-1.5 rounded-lg p-1 text-left transition-colors hover:bg-blue-50" onClick={() => setReportDrilldown({ title: `${type} issues`, rows: filteredReportRows.filter((row) => row.issueType === type).map((row) => row.complaint) })}><div className="flex justify-between text-sm"><span className="text-slate-600">{type}</span><span className="font-semibold text-slate-900">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${percentage}%` }} /></div></button>;
                })}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-slate-900">Most problematic sites</h3><MapPin className="h-4 w-4 text-slate-400" /></div>
              {problematicSites.length ? <div className="space-y-3">{problematicSites.map(([site, count], index) => <button type="button" key={site} className="flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-blue-50" onClick={() => setReportDrilldown({ title: `${site} issues`, rows: filteredReportRows.filter(({ complaint }) => (complaint.siteName || "Unknown site") === site).map((row) => row.complaint) })}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm text-slate-700">{site}</span><span className="text-sm font-semibold text-slate-900">{count} issues</span></button>)}</div> : <p className="text-sm text-slate-500">No sites match the selected filters.</p>}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="mb-3 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-600" /><h3 className="font-semibold text-amber-900">Repeated issues · last 7 days</h3></div>
            {repeatedIssues.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{repeatedIssues.slice(0, 6).map(([key, count]) => { const [site, type] = key.split("|"); return <div key={key} className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-sm"><p className="font-medium text-slate-800">{site}</p><p className="text-xs text-amber-700">{type} · {count} reports</p></div>; })}</div> : <p className="text-sm text-amber-800">No repeated issues found in the last 7 days.</p>}
          </div>
        </CardContent>
      </Card>
      )}

      <ComplaintsTable
        complaints={userVisibleComplaints}
        isLoading={complaintsLoading}
        currentUserId={appUser?.id}
        isAdmin={isAdmin}
        onStatusUpdateClick={(complaint) => {
          setSelectedComplaintForStatus(complaint);
          setShowStatusUpdateDialog(true);
        }}
        onFollowUpClick={(complaint) => {
          setSelectedComplaintForFollowUp(complaint);
          setShowFollowUpDialog(true);
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
              <SiteSelectDropdown
                sites={filteredSites}
                value={formData.siteId}
                onChange={(siteId) => setFormData({ ...formData, siteId })}
                placeholder={formData.projectId ? "Search and select a site..." : "Please select a project first"}
                disabled={!formData.projectId}
              />
              {!formData.projectId && (
                <p className="text-xs text-gray-500 mt-1">Select a project first to see available sites</p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject" className="font-semibold">Subject *</Label>
              <Select value={subjectMode === "custom" ? "custom" : formData.subject} onValueChange={(value) => {
                if (value === "custom") {
                  setSubjectMode("custom");
                  setFormData({ ...formData, subject: "" });
                } else {
                  setSubjectMode("preset");
                  setFormData({ ...formData, subject: value });
                }
              }}>
                <SelectTrigger id="subject"><SelectValue placeholder="Select a subject" /></SelectTrigger>
                <SelectContent>
                  {complaintSubjectOptions.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
                  <SelectItem value="custom">Type a custom subject</SelectItem>
                </SelectContent>
              </Select>
              {subjectMode === "custom" && <Input id="custom-subject" autoFocus placeholder="Enter complaint subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} maxLength={200} />}
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

      <Dialog open={Boolean(reportDrilldown)} onOpenChange={(open) => !open && setReportDrilldown(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{reportDrilldown?.title}</DialogTitle>
            <DialogDescription>{reportDrilldown?.rows.length || 0} matching issue{reportDrilldown?.rows.length === 1 ? "" : "s"}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Issue Type</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {reportDrilldown?.rows.map((complaint) => <TableRow key={complaint.id}><TableCell className="font-medium">{complaint.siteName || "Unknown site"}</TableCell><TableCell>{getIssueType(complaint)}</TableCell><TableCell className="max-w-[260px] truncate">{complaint.subject}</TableCell><TableCell><Badge variant={complaint.status === "Resolved" ? "secondary" : "default"}>{complaint.status}</Badge></TableCell><TableCell>{complaint.date}</TableCell></TableRow>)}
            </TableBody>
          </Table>
          {!reportDrilldown?.rows.length && <p className="py-8 text-center text-sm text-slate-500">No issues found for this selection.</p>}
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

      {/* Follow-up Dialog */}
      <FollowUpDialog
        open={showFollowUpDialog}
        onOpenChange={setShowFollowUpDialog}
        complaint={selectedComplaintForFollowUp}
        onSuccess={() => {
          setSelectedComplaintForFollowUp(null);
          queryClient.invalidateQueries({ queryKey: ["complaints"] });
          navigate("/complaints");
        }}
      />

      {/* Existing Open Ticket Dialog */}
      <Dialog open={showExistingTicketDialog} onOpenChange={setShowExistingTicketDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Ticket Already Open
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <span className="font-semibold">This site already has an open ticket.</span> You cannot create a new ticket for the same site until the existing one is resolved.
              </p>
            </div>

            {existingTicketDetails && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Subject</p>
                  <p className="text-sm text-gray-900 mt-1">{existingTicketDetails.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Status</p>
                  <Badge className="mt-1 bg-yellow-100 text-yellow-800">{existingTicketDetails.status}</Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Created On</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {format(new Date(existingTicketDetails.createdTime), "MMM dd, yyyy 'at' hh:mm a")}
                  </p>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-600">
              Please resolve the existing ticket or contact support if you need assistance.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExistingTicketDialog(false)}
            >
              Understood
            </Button>
            <Button
              onClick={() => {
                setShowExistingTicketDialog(false);
                setSelectedComplaintForFollowUp(existingTicketDetails);
                setShowFollowUpDialog(true);
              }}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Follow up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
