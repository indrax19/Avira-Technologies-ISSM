import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  siteSurveyReportAPI,
  textileSurveyReportAPI,
} from "@/integrations/firebase/siteSurveyReportAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Eye, Edit, Download, Trash2, Copy } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateSurveyReportPDF, generateTextileSurveyPDF } from "@/lib/surveyPDFGenerator";
import { companyProfileAPI } from "@/integrations/firebase/firestore";

export default function SiteSurveyReports() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ["survey-reports"],
    queryFn: siteSurveyReportAPI.getAll,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "stale",
  });

  const filtered = useMemo(() => {
    if (!reports) return [];
    return reports.filter((report) =>
      report.clientFacility.toLowerCase().includes(search.toLowerCase()) ||
      report.focalPerson.toLowerCase().includes(search.toLowerCase()) ||
      report.contactNumber.includes(search)
    );
  }, [reports, search]);

  const toggleReportSelection = (reportId: string, checked: boolean) => {
    setSelectedReportIds((current) => {
      const next = new Set(current);
      if (checked) next.add(reportId);
      else next.delete(reportId);
      return next;
    });
  };

  const toggleAllVisibleReports = (checked: boolean) => {
    setSelectedReportIds((current) => {
      const next = new Set(current);
      filtered.forEach((report) => {
        if (!report.id) return;
        if (checked) next.add(report.id);
        else next.delete(report.id);
      });
      return next;
    });
  };

  const downloadPDF = async (reportId: string) => {
    try {
      const report = reports?.find((item) => item.id === reportId);
      if (!report) return;

      if (report.category === "textile") {
        const profiles = await companyProfileAPI.getAll();
        const issmProfile = profiles.find((profile) =>
          profile.company_name.toLowerCase().includes("issm")
        ) || profiles[0];

        await generateTextileSurveyPDF({
          ...report,
          companyProfileId: issmProfile?.id,
        });
        toast.success("Textile survey PDF downloaded");
      } else {
        await generateSurveyReportPDF(report);
        toast.success("Professional PDF downloaded successfully");
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
    }
  };

  const downloadSelectedPDFs = async () => {
    const selectedReports = filtered.filter((report) => report.id && selectedReportIds.has(report.id));
    if (!selectedReports.length) return;

    try {
      const profiles = selectedReports.some((report) => report.category === "textile")
        ? await companyProfileAPI.getAll()
        : [];
      const issmProfile = profiles.find((profile) =>
        profile.company_name.toLowerCase().includes("issm")
      ) || profiles[0];

      for (const report of selectedReports) {
        if (report.category === "textile") {
          await generateTextileSurveyPDF({ ...report, companyProfileId: issmProfile?.id });
        } else {
          await generateSurveyReportPDF(report);
        }
      }
      toast.success(`${selectedReports.length} separate PDF${selectedReports.length === 1 ? "" : "s"} downloaded`);
      setSelectedReportIds(new Set());
    } catch (error) {
      console.error("Error downloading selected PDFs:", error);
      toast.error("Failed to download selected PDFs");
    }
  };

  const deleteReport = async (report: any) => {
    if (!report.id || !window.confirm("Delete this survey report?")) return;

    try {
      if (report.category === "textile") {
        await textileSurveyReportAPI.delete(report.id);
      } else {
        await siteSurveyReportAPI.delete(report.id);
      }
      await refetch();
      toast.success("Survey report deleted");
    } catch (error) {
      console.error("Error deleting survey report:", error);
      toast.error("Failed to delete survey report");
    }
  };

  const duplicateReportMutation = useMutation({
    mutationFn: async (report: any) => {
      const newReportData = { ...report };
      delete newReportData.id;
      delete newReportData.created_at;
      delete newReportData.updated_at;

      if (report.category === "textile") {
        return textileSurveyReportAPI.create(newReportData);
      } else {
        return siteSurveyReportAPI.create(newReportData);
      }
    },
    onSuccess: async () => {
      await refetch();
      toast.success("Survey report duplicated successfully");
    },
    onError: (error: any) => {
      console.error("Duplicate error:", error);
      toast.error(error?.message || "Failed to duplicate report");
    },
  });

  const handleDuplicateReport = (report: any) => {
    duplicateReportMutation.mutate(report);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Site Survey Reports</h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage and view all site survey reports
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate("/survey-reports/category")}
          className="bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search by facility, focal person, or contact number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="focus-visible:ring-2 focus-visible:ring-brand-primary"
          />
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>All Reports</CardTitle>
          <Button
            onClick={downloadSelectedPDFs}
            disabled={selectedReportIds.size === 0}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Selected ({selectedReportIds.size})
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-600">Loading reports...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              {reports && reports.length === 0
                ? "No reports created yet"
                : "No reports match your search"}
            </div>
          ) : (
            <div className="w-full overflow-x-auto -mx-6 px-6">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((report) => report.id && selectedReportIds.has(report.id))}
                        onCheckedChange={(checked) => toggleAllVisibleReports(checked === true)}
                        aria-label="Select all visible reports"
                      />
                    </TableHead>
                    <TableHead className="w-12">Sr.</TableHead>
                    <TableHead>Report No.</TableHead>
                    <TableHead>Client / Facility</TableHead>
                    <TableHead>Unit Name / No.</TableHead>
                    <TableHead>Full Address / City</TableHead>
                    <TableHead>Focal Person</TableHead>
                    <TableHead>Contact Number</TableHead>
                    <TableHead>Survey Type</TableHead>
                    <TableHead>Report Date</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((report: any, index: number) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Checkbox
                          checked={Boolean(report.id && selectedReportIds.has(report.id))}
                          onCheckedChange={(checked) => report.id && toggleReportSelection(report.id, checked === true)}
                          aria-label={`Select ${report.clientFacility || report.millName || "report"}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-center text-slate-600">{filtered.length - index}</TableCell>
                      <TableCell className="font-medium text-blue-700">{report.reportNumber || "—"}</TableCell>
                      <TableCell className="font-medium">{report.clientFacility || report.millName}</TableCell>
                      <TableCell className="text-sm text-slate-600">{report.unitName || report.unitNo || "—"}</TableCell>
                      <TableCell className="text-sm text-slate-600">{report.fullAddress || report.address || "—"}</TableCell>
                      <TableCell>{report.focalPerson || report.surveyedByName || "—"}</TableCell>
                      <TableCell>{report.contactNumber || report.millContactNumber || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {report.category === "textile" ? "Textile" : (report.surveyType || "General")}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(report.reportDate || report.surveyDate), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (report.category === "textile") {
                                navigate(`/survey-reports/edit/textile/${report.id}`);
                              } else {
                                navigate(`/survey-reports/${report.id}`);
                              }
                            }}
                            title="Edit"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadPDF(report.id!)}
                            title="Download PDF"
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDuplicateReport(report)}
                            title="Duplicate"
                            disabled={duplicateReportMutation.isPending}
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteReport(report)}
                            title="Delete report"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
