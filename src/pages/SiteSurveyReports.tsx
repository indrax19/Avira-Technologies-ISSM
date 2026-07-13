import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { siteSurveyReportAPI } from "@/integrations/firebase/siteSurveyReportAPI";
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
import { ArrowLeft, Plus, Eye, Edit, Download } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addLogoToPDF } from "@/lib/pdfLogoHelper";
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

  const downloadPDF = async (reportId: string) => {
    try {
      const report = reports?.find(r => r.id === reportId);
      if (!report) return;

      const pdf = new jsPDF();
      let yPosition = 20;

      await addLogoToPDF(pdf);
      yPosition += 20;

      pdf.setFontSize(18);
      pdf.text("SITE SURVEY REPORT", 105, yPosition, { align: "center" });
      yPosition += 12;

      pdf.setFontSize(11);
      pdf.text(`Report Date: ${format(new Date(report.reportDate), "dd MMM yyyy")}`, 15, yPosition);
      yPosition += 8;
      pdf.text(`Prepared By: ${report.preparedBy}`, 15, yPosition);
      yPosition += 12;

      pdf.setFontSize(14);
      pdf.text("SITE INFORMATION", 15, yPosition);
      yPosition += 8;

      pdf.setFontSize(11);
      const infoData = [
        ["Client / Facility:", report.clientFacility],
        ["Focal Person:", report.focalPerson],
        ["Contact Number:", report.contactNumber],
        ["Project Scope:", report.projectScope],
        ["Survey Type:", report.surveyType],
      ];

      infoData.forEach(([label, value]) => {
        pdf.text(label, 15, yPosition);
        pdf.text(value, 80, yPosition);
        yPosition += 7;
      });

      yPosition += 5;

      if (report.facilityOverview.trim()) {
        pdf.setFontSize(14);
        pdf.text("FACILITY OVERVIEW", 15, yPosition);
        yPosition += 8;

        pdf.setFontSize(11);
        const splitText = pdf.splitTextToSize(report.facilityOverview, 180);
        pdf.text(splitText, 15, yPosition);
        yPosition += splitText.length * 5 + 5;
      }

      if (report.gateWiseSummary && report.gateWiseSummary.some(item => item.gateName.trim())) {
        if (yPosition > 240) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(14);
        pdf.text("GATE-WISE SURVEY SUMMARY", 15, yPosition);
        yPosition += 8;

        const gateTableData = report.gateWiseSummary
          .filter(item => item.gateName.trim())
          .map(item => [item.gateName, item.function, item.cameraRequired, item.notes]);

        autoTable(pdf, {
          startY: yPosition,
          head: [["Gate Name", "Function", "Camera Required", "Notes"]],
          body: gateTableData,
          theme: "grid",
          headStyles: { fillColor: [39, 60, 112], textColor: 255, fontStyle: "bold" },
          margin: { left: 15, right: 15 },
        });

        yPosition = (pdf as any).lastAutoTable.finalY + 10;
      }

      if (report.networkCablingRequirements && report.networkCablingRequirements.some(item => item.item.trim())) {
        if (yPosition > 240) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(14);
        pdf.text("NETWORK & CABLING REQUIREMENTS", 15, yPosition);
        yPosition += 8;

        const networkTableData = report.networkCablingRequirements
          .filter(item => item.item.trim())
          .map(item => [item.item, item.quantity, item.purpose]);

        autoTable(pdf, {
          startY: yPosition,
          head: [["Item", "Quantity", "Purpose"]],
          body: networkTableData,
          theme: "grid",
          headStyles: { fillColor: [39, 60, 112], textColor: 255, fontStyle: "bold" },
          margin: { left: 15, right: 15 },
        });
      }

      const fileName = `Survey_Report_${report.clientFacility.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
      pdf.save(fileName);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
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
          onClick={() => navigate("/survey-reports/new")}
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
                    <TableHead>Client / Facility</TableHead>
                    <TableHead>Focal Person</TableHead>
                    <TableHead>Contact Number</TableHead>
                    <TableHead>Survey Type</TableHead>
                    <TableHead>Report Date</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.clientFacility}</TableCell>
                      <TableCell>{report.focalPerson}</TableCell>
                      <TableCell>{report.contactNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.surveyType}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(report.reportDate), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/survey-reports/${report.id}`)}
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
