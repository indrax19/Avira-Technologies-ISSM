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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Eye, Edit, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export default function SiteSurveyReports() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

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

  const downloadTextilePDF = (report: any) => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let yPosition = 18;
    const navy = [39, 60, 112] as [number, number, number];

    pdf.setFillColor(...navy);
    pdf.rect(0, 0, pageWidth, 30, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("TEXTILE MILL SURVEY REPORT", margin, yPosition);
    yPosition = 42;

    const addSection = (title: string, rows: string[][]) => {
      if (yPosition > pageHeight - 45) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.setFillColor(...navy);
      pdf.rect(margin, yPosition, contentWidth, 7, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(title, margin + 4, yPosition + 5);
      yPosition += 12;
      rows.forEach(([label, value]) => {
        const wrapped = pdf.splitTextToSize(value || "—", contentWidth - 65);
        pdf.setTextColor(71, 85, 105);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.text(label, margin + 4, yPosition);
        pdf.setTextColor(15, 23, 42);
        pdf.setFont("helvetica", "normal");
        pdf.text(wrapped, margin + 65, yPosition);
        yPosition += Math.max(5, wrapped.length * 4 + 1);
      });
      yPosition += 5;
    };

    addSection("MILL / FACILITY IDENTIFICATION", [
      ["Mill Name", report.millName],
      ["Unit Name / No.", report.unitName],
      ["Address / City", report.fullAddress],
      ["Total Units", report.totalUnits],
      ["Survey Date", report.surveyDate],
      ["Surveyed By", report.surveyedByName],
      ["Contact Person", report.millContactPerson],
      ["Contact No. / Email", report.millContactNumber],
    ]);

    addSection("BLOW ROOM INVENTORY", (report.blowRooms || []).map((room: any, index: number) => [
      `Blow Room ${index + 1}`,
      [room.blowRoomNo, room.entryPoints, room.cameraLocation, room.lightingCondition]
        .filter(Boolean)
        .join(" · "),
    ]));

    addSection("CONNECTIVITY AND POWER", [
      ["Waste Flow", report.wasteFlowOption],
      ["Waste Flow Remarks", report.wasteFlowRemarks],
      ["Internet Available", report.internetAvailable ? "Yes" : "No"],
      ["Connection Types", (report.connectionTypes || []).join(", ")],
      ["Internet Quality", report.internetQuality],
      ["ISP / Provider", report.ispProviderName],
      ["UPS Available", report.upsAvailable ? "Yes" : "No"],
      ["UPS Capacity", report.upsCapacity],
      ["UPS Backup Time", report.upsBackupTime],
    ]);

    addSection("COMPUTE AND REMARKS", [
      ["GPU Compute Details", report.gpuCompute],
      ["General Remarks", report.generalRemarks],
      ["Surveyor Signature", report.surveyorSignature],
      ["Customer Representative", report.customerRepresentativeSignature],
    ]);

    const pageCount = (pdf as any).internal.pages.length - 1;
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    }
    const fileName = `Textile_Survey_${(report.millName || "Report").replace(/\\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
    pdf.save(fileName);
  };

  const downloadPDF = async (reportId: string) => {
    try {
      const report = reports?.find((item) => item.id === reportId);
      if (!report) return;
      if (report.category === "textile") {
        downloadTextilePDF(report);
        toast.success("Textile survey PDF downloaded");
        return;
      }

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = 42;
      const navy = [39, 60, 112] as [number, number, number];
      const slate = [71, 85, 105] as [number, number, number];

      pdf.setFillColor(...navy);
      pdf.rect(0, 0, pageWidth, 35, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("SITE SURVEY REPORT", margin, 17);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("AVIRA TECHNOLOGIES", margin, 25);
      pdf.text("CONFIDENTIAL", pageWidth - margin, 25, { align: "right" });

      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(margin, yPosition - 7, contentWidth, 17, 2, 2, "F");
      pdf.setTextColor(...slate);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("REPORT DATE", margin + 6, yPosition);
      pdf.text("PREPARED BY", margin + contentWidth / 2, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(15, 23, 42);
      pdf.text(format(new Date(report.reportDate), "dd MMM yyyy"), margin + 6, yPosition + 6);
      pdf.text(report.preparedBy || "—", margin + contentWidth / 2, yPosition + 6);
      yPosition += 23;

      const drawSectionHeader = (title: string) => {
        pdf.setFillColor(...navy);
        pdf.roundedRect(margin, yPosition, contentWidth, 8, 1.5, 1.5, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(title, margin + 5, yPosition + 5.5);
        pdf.setTextColor(15, 23, 42);
        yPosition += 13;
      };

      drawSectionHeader("SITE INFORMATION");
      const infoData = [
        ["Client / Facility", report.clientFacility],
        ["Focal Person", report.focalPerson],
        ["Contact Number", report.contactNumber],
        ["Project Scope", report.projectScope],
        ["Survey Type", report.surveyType],
      ];
      pdf.setFontSize(9.5);
      infoData.forEach(([label, value], index) => {
        if (index % 2 === 0) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, yPosition - 4.5, contentWidth, 7, "F");
        }
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...slate);
        pdf.text(label, margin + 5, yPosition);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(15, 23, 42);
        pdf.text(pdf.splitTextToSize(value || "—", contentWidth - 65), margin + 58, yPosition);
        yPosition += 7;
      });
      yPosition += 7;

      if (report.facilityOverview.trim()) {
        if (yPosition > pageHeight - 55) { pdf.addPage(); yPosition = margin; }
        drawSectionHeader("FACILITY OVERVIEW");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        const overview = pdf.splitTextToSize(report.facilityOverview, contentWidth - 10);
        pdf.text(overview, margin + 5, yPosition);
        yPosition += overview.length * 5 + 10;
      }

      if (report.gateWiseSummary?.some((item) => item.gateName.trim())) {
        if (yPosition > pageHeight - 65) { pdf.addPage(); yPosition = margin; }
        drawSectionHeader("GATE-WISE SURVEY SUMMARY");
        autoTable(pdf, {
          startY: yPosition,
          head: [["Gate Name", "Function", "Camera Required", "Notes"]],
          body: report.gateWiseSummary.filter((item) => item.gateName.trim()).map((item) => [item.gateName, item.function, item.cameraRequired, item.notes]),
          margin: { left: margin, right: margin },
          theme: "grid",
          headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold", fontSize: 9, cellPadding: 3 },
          bodyStyles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 34 }, 2: { cellWidth: 31 }, 3: { cellWidth: 67 } },
        });
        yPosition = (pdf as any).lastAutoTable.finalY + 12;
      }

      if (report.networkCablingRequirements?.some((item) => item.item.trim())) {
        if (yPosition > pageHeight - 65) { pdf.addPage(); yPosition = margin; }
        drawSectionHeader("NETWORK & CABLING REQUIREMENTS");
        autoTable(pdf, {
          startY: yPosition,
          head: [["Item", "Quantity", "Purpose"]],
          body: report.networkCablingRequirements.filter((item) => item.item.trim()).map((item) => [item.item, item.quantity, item.purpose]),
          margin: { left: margin, right: margin },
          theme: "grid",
          headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold", fontSize: 9, cellPadding: 3 },
          bodyStyles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 35 }, 2: { cellWidth: 79 } },
        });
      }

      const pageCount = (pdf as any).internal.pages.length - 1;
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...slate);
        pdf.text("Avira Technologies · Site Survey Report", margin, pageHeight - 8);
        pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      }

      const fileName = `Survey_Report_${report.clientFacility.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
      pdf.save(fileName);
      toast.success("Professional PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
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
        <CardHeader>
          <CardTitle>All Reports</CardTitle>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Sr.</TableHead>
                    <TableHead>Client / Facility</TableHead>
                    <TableHead>Focal Person</TableHead>
                    <TableHead>Contact Number</TableHead>
                    <TableHead>Survey Type</TableHead>
                    <TableHead>Report Date</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((report: any, index: number) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium text-center text-slate-600">{filtered.length - index}</TableCell>
                      <TableCell className="font-medium">{report.clientFacility || report.millName}</TableCell>
                      <TableCell>{report.focalPerson || report.surveyedByName || "—"}</TableCell>
                      <TableCell>{report.contactNumber || report.millContactNumber || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {report.category === "textile" ? "Textile" : (report.surveyType || "General")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(report.reportDate || report.surveyDate), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
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
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadPDF(report.id!)}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteReport(report)}
                            title="Delete report"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
