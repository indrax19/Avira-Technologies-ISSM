import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { companyProfileAPI, CompanyProfile } from "@/integrations/firebase/firestore";
import { addLogoToPDF } from "./pdfLogoHelper";

const NAVY = [39, 60, 112] as [number, number, number];
const SLATE = [71, 85, 105] as [number, number, number];
const LIGHT_BG = [245, 247, 250] as [number, number, number];
const ALT_ROW_BG = [248, 250, 252] as [number, number, number];

interface SurveyReportData {
  id: string;
  clientFacility: string;
  focalPerson: string;
  contactNumber: string;
  projectScope: string;
  surveyType: string;
  reportDate: string | Date;
  preparedBy: string;
  facilityOverview?: string;
  gateWiseSummary?: Array<{
    gateName: string;
    function: string;
    cameraRequired: string;
    notes: string;
  }>;
  networkCablingRequirements?: Array<{
    item: string;
    quantity: string;
    purpose: string;
  }>;
  companyProfileId?: string;
}

export async function generateSurveyReportPDF(report: SurveyReportData) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let yPosition = 18;
  let companyProfile: CompanyProfile | null = null;

  // Fetch company profile if provided
  if (report.companyProfileId) {
    try {
      companyProfile = await companyProfileAPI.getById(report.companyProfileId);
    } catch (error) {
      console.error("Error fetching company profile:", error);
    }
  }

  // Professional header with logo and company info
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, pageWidth, 40, "F");

  let logoHeight = 0;
  if (companyProfile?.logo_url) {
    try {
      logoHeight = await addLogoToPDF(
        pdf,
        companyProfile.logo_url,
        margin,
        8,
        { maxWidth: 25, maxHeight: 20 }
      );
    } catch (error) {
      console.error("Error adding logo:", error);
    }
  }

  // Title on the right
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("SITE SURVEY REPORT", pageWidth / 2, 20, { align: "center" });

  // Company info on right side
  if (companyProfile) {
    const rightX = pageWidth - margin - 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(companyProfile.company_name || "Company", rightX, 12, {
      align: "right",
    });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    let infoY = 16;

    if (companyProfile.phone) {
      pdf.text(`Ph: ${companyProfile.phone}`, rightX, infoY, { align: "right" });
      infoY += 3;
    }
    if (companyProfile.email) {
      pdf.text(`Email: ${companyProfile.email}`, rightX, infoY, {
        align: "right",
      });
      infoY += 3;
    }
    if (companyProfile.website) {
      pdf.text(`Web: ${companyProfile.website}`, rightX, infoY, {
        align: "right",
      });
    }
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("AVIRA TECHNOLOGIES", pageWidth - margin, 16, { align: "right" });
  }

  yPosition = 45;

  // Report metadata bar
  pdf.setFillColor(...LIGHT_BG);
  pdf.rect(margin, yPosition, contentWidth, 14, "F");

  pdf.setTextColor(...SLATE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("REPORT DATE", margin + 5, yPosition + 4);
  pdf.text("PREPARED BY", margin + contentWidth / 2, yPosition + 4);

  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    format(new Date(report.reportDate), "dd MMM yyyy"),
    margin + 5,
    yPosition + 9
  );
  pdf.text(report.preparedBy || "—", margin + contentWidth / 2, yPosition + 9);

  yPosition += 20;

  const drawSectionHeader = (title: string) => {
    pdf.setFillColor(...NAVY);
    pdf.roundedRect(margin, yPosition, contentWidth, 7, 1, 1, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(title, margin + 4, yPosition + 4.5);
    pdf.setTextColor(15, 23, 42);
    yPosition += 11;
  };

  const addSectionContent = (
    rows: Array<[string, string]>
  ) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    rows.forEach(([label, value], index) => {
      // Alternate row background
      if (index % 2 === 0) {
        pdf.setFillColor(...ALT_ROW_BG);
        pdf.rect(margin, yPosition - 4, contentWidth, 6.5, "F");
      }

      // Label
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...SLATE);
      pdf.text(label, margin + 4, yPosition);

      // Value
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(15, 23, 42);
      const maxValueWidth = contentWidth - 65;
      const wrappedValue = pdf.splitTextToSize(value || "—", maxValueWidth);
      pdf.text(wrappedValue, margin + 65, yPosition);

      yPosition += Math.max(6.5, wrappedValue.length * 4);
    });

    yPosition += 5;
  };

  // Site Information Section
  drawSectionHeader("SITE INFORMATION");
  addSectionContent([
    ["Client / Facility", report.clientFacility],
    ["Focal Person", report.focalPerson],
    ["Contact Number", report.contactNumber],
    ["Project Scope", report.projectScope],
    ["Survey Type", report.surveyType],
  ]);

  // Facility Overview Section
  if (report.facilityOverview?.trim()) {
    if (yPosition > pageHeight - 55) {
      pdf.addPage();
      yPosition = margin;
    }

    drawSectionHeader("FACILITY OVERVIEW");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    const overview = pdf.splitTextToSize(report.facilityOverview, contentWidth - 8);
    pdf.text(overview, margin + 4, yPosition);
    yPosition += overview.length * 4.5 + 8;
  }

  // Gate-Wise Summary Table
  if (report.gateWiseSummary?.some((item) => item.gateName.trim())) {
    if (yPosition > pageHeight - 65) {
      pdf.addPage();
      yPosition = margin;
    }

    drawSectionHeader("GATE-WISE SURVEY SUMMARY");
    autoTable(pdf, {
      startY: yPosition,
      head: [["Gate Name", "Function", "Camera Required", "Notes"]],
      body: report.gateWiseSummary
        .filter((item) => item.gateName.trim())
        .map((item) => [item.gateName, item.function, item.cameraRequired, item.notes]),
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: {
        fillColor: NAVY,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: { fillColor: ALT_ROW_BG },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 34 },
        2: { cellWidth: 31 },
        3: { cellWidth: 67 },
      },
    });
    yPosition = (pdf as any).lastAutoTable.finalY + 10;
  }

  // Network & Cabling Requirements Table
  if (report.networkCablingRequirements?.some((item) => item.item.trim())) {
    if (yPosition > pageHeight - 65) {
      pdf.addPage();
      yPosition = margin;
    }

    drawSectionHeader("NETWORK & CABLING REQUIREMENTS");
    autoTable(pdf, {
      startY: yPosition,
      head: [["Item", "Quantity", "Purpose"]],
      body: report.networkCablingRequirements
        .filter((item) => item.item.trim())
        .map((item) => [item.item, item.quantity, item.purpose]),
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: {
        fillColor: NAVY,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: { fillColor: ALT_ROW_BG },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 35 },
        2: { cellWidth: 79 },
      },
    });
  }

  // Add footer with page numbers and confidential mark
  const pageCount = (pdf as any).internal.pages.length - 1;
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);

    // Footer line
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

    // Footer text
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...SLATE);

    const footerText = companyProfile
      ? `${companyProfile.company_name} · Site Survey Report`
      : "Avira Technologies · Site Survey Report";

    pdf.text(footerText, margin, pageHeight - 8);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    });

    // Confidential mark
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text("CONFIDENTIAL", pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  // Generate filename
  const fileName = `Survey_Report_${report.clientFacility.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  pdf.save(fileName);
}

// Helper for textile survey
interface TextileSurveyData extends SurveyReportData {
  millName?: string;
  unitName?: string;
  fullAddress?: string;
  totalUnits?: string;
  surveyDate?: string;
  surveyedByName?: string;
  millContactPerson?: string;
  millContactNumber?: string;
  wasteFlowOption?: string;
  wasteFlowRemarks?: string;
  internetAvailable?: string;
  connectionTypes?: string;
  internetQuality?: string;
  ispProviderName?: string;
  upsAvailable?: string;
  upsCapacity?: string;
  upsBackupTime?: string;
  gpuCompute?: string;
  generalRemarks?: string;
  surveyorSignature?: string;
  customerRepresentativeSignature?: string;
  blowRooms?: Array<{
    roomNumber?: string;
    spinningFrames?: string;
    spindles?: string;
  }>;
}

export async function generateTextileSurveyPDF(report: TextileSurveyData) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let yPosition = 18;
  let companyProfile: CompanyProfile | null = null;

  // Fetch company profile if provided
  if (report.companyProfileId) {
    try {
      companyProfile = await companyProfileAPI.getById(report.companyProfileId);
    } catch (error) {
      console.error("Error fetching company profile:", error);
    }
  }

  // Professional header
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, pageWidth, 40, "F");

  let logoHeight = 0;
  if (companyProfile?.logo_url) {
    try {
      logoHeight = await addLogoToPDF(
        pdf,
        companyProfile.logo_url,
        margin,
        8,
        { maxWidth: 25, maxHeight: 20 }
      );
    } catch (error) {
      console.error("Error adding logo:", error);
    }
  }

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("TEXTILE MILL SURVEY REPORT", pageWidth / 2, 20, { align: "center" });

  // Company info
  if (companyProfile) {
    const rightX = pageWidth - margin - 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(companyProfile.company_name || "Company", rightX, 12, {
      align: "right",
    });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    let infoY = 16;

    if (companyProfile.phone) {
      pdf.text(`Ph: ${companyProfile.phone}`, rightX, infoY, { align: "right" });
      infoY += 3;
    }
    if (companyProfile.email) {
      pdf.text(`Email: ${companyProfile.email}`, rightX, infoY, {
        align: "right",
      });
      infoY += 3;
    }
  }

  yPosition = 45;

  const addSection = (title: string, rows: Array<[string, string]>) => {
    if (yPosition > pageHeight - 45) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFillColor(...NAVY);
    pdf.roundedRect(margin, yPosition, contentWidth, 7, 1, 1, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(title, margin + 4, yPosition + 4.5);
    yPosition += 11;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);

    rows.forEach(([label, value], index) => {
      if (yPosition > pageHeight - 15) {
        pdf.addPage();
        yPosition = margin;
      }

      const wrappedValue = pdf.splitTextToSize(value || "—", contentWidth - 65);
      pdf.setTextColor(...SLATE);
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin + 4, yPosition);

      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "normal");
      pdf.text(wrappedValue, margin + 65, yPosition);

      yPosition += Math.max(5, wrappedValue.length * 4 + 1);
    });

    yPosition += 5;
  };

  // Sections
  addSection("MILL / FACILITY IDENTIFICATION", [
    ["Mill Name", report.millName || ""],
    ["Unit Name / No.", report.unitName || ""],
    ["Address / City", report.fullAddress || ""],
    ["Total Units", report.totalUnits || ""],
    ["Survey Date", report.surveyDate || ""],
    ["Surveyed By", report.surveyedByName || ""],
    ["Contact Person", report.millContactPerson || ""],
    ["Contact No.", report.millContactNumber || ""],
  ]);

  addSection("WASTE FLOW INFORMATION", [
    ["Waste Flow Option", report.wasteFlowOption || ""],
    ["Remarks", report.wasteFlowRemarks || ""],
  ]);

  addSection("INTERNET & CONNECTIVITY", [
    ["Internet Available", report.internetAvailable || ""],
    ["Connection Types", report.connectionTypes || ""],
    ["Quality", report.internetQuality || ""],
    ["ISP Provider", report.ispProviderName || ""],
  ]);

  addSection("POWER & COMPUTE", [
    ["UPS Available", report.upsAvailable || ""],
    ["UPS Capacity", report.upsCapacity || ""],
    ["Backup Time", report.upsBackupTime || ""],
    ["GPU / Compute", report.gpuCompute || ""],
  ]);

  addSection("GENERAL REMARKS", [["Remarks", report.generalRemarks || ""]]);

  // Footer
  const pageCount = (pdf as any).internal.pages.length - 1;
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...SLATE);

    const footerText = companyProfile
      ? `${companyProfile.company_name} · Textile Mill Survey Report`
      : "Avira Technologies · Textile Mill Survey Report";

    pdf.text(footerText, margin, pageHeight - 8);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }

  const fileName = `Textile_Survey_${report.millName?.replace(/\s+/g, "_") || "Report"}_${format(new Date(), "yyyyMMdd")}.pdf`;
  pdf.save(fileName);
}
