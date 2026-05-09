import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { siteDetailsAPI, SiteDetails, CameraConfig } from "@/integrations/firebase/siteDetailsAPI";
import { deploymentCertificateAPI, DeploymentCertificate, companyProfileAPI, CompanyProfile } from "@/integrations/firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Download, Upload, Camera, Loader2, X, FileText, Printer, Eye, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportSiteToExcel } from "@/lib/excelExport";
import { downloadDeploymentCertificatePDF, printDeploymentCertificate } from "@/lib/pdfGenerator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Helper function to format date as "13 march 2026"
const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" }).toLowerCase();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

// Helper function to parse date from "13 march 2026" back to ISO format
const parseDateFromDisplay = (displayDate: string): string => {
  if (!displayDate) return new Date().toISOString().split("T")[0];
  try {
    const date = new Date(displayDate);
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
};

// Helper function to convert ISO date to readable display format
const isoToDisplayDate = (isoDate: string): string => {
  if (!isoDate) return "";
  return formatDateForDisplay(new Date(isoDate).toISOString());
};

const getCertificateFormStorageKey = (siteId: string) => `site_certificate_form_${siteId}`;

const loadCertificateFormData = (siteId: string) => {
  try {
    const stored = localStorage.getItem(getCertificateFormStorageKey(siteId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const saveCertificateFormData = (siteId: string, data: any) => {
  try {
    localStorage.setItem(getCertificateFormStorageKey(siteId), JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

const clearCertificateFormData = (siteId: string) => {
  try {
    localStorage.removeItem(getCertificateFormStorageKey(siteId));
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

export default function SiteDetailsForm() {
  const { id, technicalProjectId } = useParams<{ id: string; technicalProjectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form states
  const [supervisorName, setSupervisorName] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [dateInput, setDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [millName, setMillName] = useState("");
  const [millLocation, setMillLocation] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [pocName, setPocName] = useState("");
  const [pocContact, setPocContact] = useState("");
  const [gpuUserName, setGpuUserName] = useState("");
  const [gpuPassword, setGpuPassword] = useState("Sonicgpu786");
  const [anydeskId, setAnydeskId] = useState("");
  const [anydeskPassword, setAnydeskPassword] = useState("Sonicgpu786");
  const [anydeskId2, setAnydeskId2] = useState("");
  const [anydeskPassword2, setAnydeskPassword2] = useState("Sonicgpu786");
  const [tailscaleIp, setTailscaleIp] = useState("");
  const [remoteanydeskPassword, setRemoteanydeskPassword] = useState("Sonicgpu786");
  const [remoteanydeskAccountName, setRemoteanydeskAccountName] = useState("");
  const [rustdeskId, setRustdeskId] = useState("");
  const [rustdeskPassword, setRustdeskPassword] = useState("Sonicgpu786");
  const [rustdeskId2, setRustdeskId2] = useState("");
  const [rustdeskPassword2, setRustdeskPassword2] = useState("Sonicgpu786");
  const [pcNic, setPcNic] = useState("");
  const [subnet, setSubnet] = useState("");
  const [defaultGateway, setDefaultGateway] = useState("");
  const [dns, setDns] = useState("");
  const [liveIp, setLiveIp] = useState("");
  const [nvrIp, setNvrIp] = useState("");
  const [nvrPort, setNvrPort] = useState("");
  const [nvrUsername, setNvrUsername] = useState("admin");
  const [nvrPassword, setNvrPassword] = useState("Sonicnvr786");
  const [cameraUsername, setCameraUsername] = useState("admin");
  const [cameraPassword, setCameraPassword] = useState("Sonicnvr786");
  const [cameras, setCameras] = useState<CameraConfig[]>([
    { id: "0", name: "Camera 1", ip: "" },
  ]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [hardwareCompleted, setHardwareCompleted] = useState(false);
  const [dataCopy, setDataCopy] = useState(false);
  const [patch1Date, setPatch1Date] = useState("");
  const [patch2Date, setPatch2Date] = useState("");
  const [completionCertificate, setCompletionCertificate] = useState(false);
  const [roiCreated, setRoiCreated] = useState(false);
  const [savedSite, setSavedSite] = useState<SiteDetails | null>(null);
  const [existingSite, setExistingSite] = useState<SiteDetails | null>(null);
  const [completionFormImageUrl, setCompletionFormImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Deployment Certificate states
  const [certClientName, setCertClientName] = useState("");
  const [certClientDesignation, setCertClientDesignation] = useState("");
  const [certClientDate, setCertClientDate] = useState(new Date().toISOString().split("T")[0]);
  const [certDeploymentDate, setCertDeploymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [certIssmName, setCertIssmName] = useState("");
  const [certIssmDesignation, setCertIssmDesignation] = useState("");
  const [certIssmDate, setCertIssmDate] = useState(new Date().toISOString().split("T")[0]);
  const [showCertificateForm, setShowCertificateForm] = useState(false);
  const [savingCertificate, setSavingCertificate] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<CompanyProfile[]>([]);
  const [showProfileSelectDialog, setShowProfileSelectDialog] = useState(false);
  const [selectedProfileForDownload, setSelectedProfileForDownload] = useState<string>("");
  const [downloadAction, setDownloadAction] = useState<"download" | "print">("download");
  const [certificateType, setCertificateType] = useState<"digital-eye" | "uqaab">("digital-eye");
  const [certificates, setCertificates] = useState<DeploymentCertificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [editingCertData, setEditingCertData] = useState<Partial<DeploymentCertificate>>({});
  const [updatingCert, setUpdatingCert] = useState(false);

  // Load company profiles
  useEffect(() => {
    const loadCompanyProfiles = async () => {
      try {
        const profiles = await companyProfileAPI.getAll();
        setAllProfiles(profiles);
        if (profiles.length > 0) {
          setCompanyProfile(profiles[0]);
          setSelectedProfileForDownload(profiles[0].id!);
        }
      } catch (error) {
        console.log("Could not load company profiles");
      }
    };
    loadCompanyProfiles();
  }, []);

  // Persist certificate form data whenever it changes
  useEffect(() => {
    if (id && showCertificateForm) {
      saveCertificateFormData(id, {
        certClientName,
        certClientDesignation,
        certClientDate,
        certDeploymentDate,
        certIssmName,
        certIssmDesignation,
        certIssmDate,
        certificateType,
      });
    }
  }, [id, showCertificateForm, certClientName, certClientDesignation, certClientDate, certDeploymentDate, certIssmName, certIssmDesignation, certIssmDate, certificateType]);

  // Load site details if editing with real-time updates
  useEffect(() => {
    if (!id) {
      setExistingSite(null);
      return;
    }

    // Subscribe to real-time updates for the specific site
    unsubscribeRef.current = siteDetailsAPI.subscribeById(id, (site) => {
      if (isMountedRef.current) {
        setExistingSite(site);
      }
    });

    // Cleanup subscription on unmount or when id changes
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [id]);

  // Load certificates for this site
  useEffect(() => {
    if (!id) {
      setCertificates([]);
      return;
    }

    const loadCertificates = async () => {
      try {
        setLoadingCertificates(true);
        const certs = await deploymentCertificateAPI.getBySiteId(id);
        if (isMountedRef.current) {
          setCertificates(certs);
        }
      } catch (error: any) {
        // Silently handle errors - Firestore might not have the required composite index yet
        console.error("Error loading certificates (this may require a Firestore index):", error);
        if (isMountedRef.current) {
          setCertificates([]);
        }
      } finally {
        if (isMountedRef.current) {
          setLoadingCertificates(false);
        }
      }
    };

    loadCertificates();
  }, [id]);

  useEffect(() => {
    if (existingSite) {
      setSupervisorName(existingSite.supervisorName || "");
      setTechnicianName(existingSite.technicianName || "");
      setDateInput(existingSite.date || new Date().toISOString().split("T")[0]);
      setMillName(existingSite.millName || "");
      setMillLocation(existingSite.millLocation || "");
      setUnitNo(existingSite.unitNo || "");
      setPocName(existingSite.pocName || "");
      setPocContact(existingSite.pocContact || "");
      setGpuUserName(existingSite.gpuUserName || "");
      setGpuPassword(existingSite.gpuPassword || "sonicgpu786");
      setAnydeskId(existingSite.anydeskId || "");
      setAnydeskPassword(existingSite.anydeskPassword || "sonicgpu786");
      setAnydeskId2(existingSite.anydeskId2 || "");
      setAnydeskPassword2(existingSite.anydeskPassword2 || "sonicgpu786");
      setTailscaleIp(existingSite.tailscaleIp || "");
      setRemoteanydeskPassword(existingSite.remoteanydeskPassword || "");
      setRemoteanydeskAccountName(existingSite.remoteanydeskAccountName || "");
      setRustdeskId(existingSite.rustdeskId || "");
      setRustdeskPassword(existingSite.rustdeskPassword || "");
      setRustdeskId2(existingSite.rustdeskId2 || "");
      setRustdeskPassword2(existingSite.rustdeskPassword2 || "");
      setPcNic(existingSite.pcNic || "");
      setSubnet(existingSite.subnet || "");
      setDefaultGateway(existingSite.defaultGateway || "");
      setDns(existingSite.dns || "");
      setLiveIp(existingSite.liveIp || "");
      setNvrIp(existingSite.nvrIp || "");
      setNvrPort(existingSite.nvrPort || "");
      setNvrUsername(existingSite.nvrUsername || "admin");
      setNvrPassword(existingSite.nvrPassword || "sonicnvr786");
      setCameraUsername(existingSite.cameraUsername || "admin");
      setCameraPassword(existingSite.cameraPassword || "soniccam786");
      setCameras(existingSite.cameras || []);
      setAdditionalDetails(existingSite.additionalDetails || "");
      setHardwareCompleted(existingSite.hardwareCompleted || false);
      setDataCopy(existingSite.dataCopy || false);
      setPatch1Date(existingSite.patch1Date || "");
      setPatch2Date(existingSite.patch2Date || "");
      setCompletionCertificate(existingSite.completionCertificate || false);
      setRoiCreated(existingSite.roiCreated || false);
      setCompletionFormImageUrl(existingSite.completionFormImageUrl || null);
    }
  }, [existingSite]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!millName.trim()) {
        toast.error("Mill Name is required");
        throw new Error("Mill Name required");
      }

      const siteData: SiteDetails = {
        supervisorName: supervisorName || undefined,
        technicianName: technicianName || undefined,
        date: dateInput,
        millName: millName || undefined,
        millLocation: millLocation || undefined,
        unitNo: unitNo || undefined,
        pocName: pocName || undefined,
        pocContact: pocContact || undefined,
        gpuUserName: gpuUserName || undefined,
        gpuPassword: gpuPassword || undefined,
        anydeskId: anydeskId || undefined,
        anydeskPassword: anydeskPassword || undefined,
        anydeskId2: anydeskId2 || undefined,
        anydeskPassword2: anydeskPassword2 || undefined,
        tailscaleIp: tailscaleIp || undefined,
        remoteanydeskPassword: remoteanydeskPassword || undefined,
        remoteanydeskAccountName: remoteanydeskAccountName || undefined,
        rustdeskId: rustdeskId || undefined,
        rustdeskPassword: rustdeskPassword || undefined,
        rustdeskId2: rustdeskId2 || undefined,
        rustdeskPassword2: rustdeskPassword2 || undefined,
        pcNic: pcNic || undefined,
        subnet: subnet || undefined,
        defaultGateway: defaultGateway || undefined,
        dns: dns || undefined,
        liveIp: liveIp || undefined,
        nvrIp: nvrIp || undefined,
        nvrPort: nvrPort || undefined,
        nvrUsername: nvrUsername || undefined,
        nvrPassword: nvrPassword || undefined,
        cameraUsername: cameraUsername || undefined,
        cameraPassword: cameraPassword || undefined,
        cameras: cameras.filter((c) => c.name),
        additionalDetails: additionalDetails || undefined,
        hardwareCompleted,
        dataCopy,
        patch1Date: patch1Date || undefined,
        patch2Date: patch2Date || undefined,
        completionCertificate,
        roiCreated,
        completionFormImageUrl: completionFormImageUrl || undefined,
        technical_project_id: technicalProjectId || undefined,
      };

      let result;
      if (id) {
        await siteDetailsAPI.update(id, siteData);
        result = { ...siteData, id };
      } else {
        result = await siteDetailsAPI.create(siteData);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setSavedSite(result);
      toast.success(id ? "Site details updated" : "Site details created");
      // Navigate back after successful save
      setTimeout(() => {
        if (technicalProjectId) {
          navigate(`/technical-projects/${technicalProjectId}`);
        } else {
          navigate("/sites");
        }
      }, 500);
    },
    onError: (err: any) => {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save site details");
    },
  });

  const addCamera = () => {
    const newNumber = cameras.length + 1;
    setCameras((prev) => [
      ...prev,
      { id: Date.now().toString(), name: `Camera ${newNumber}`, username: "", password: "" },
    ]);
  };

  const removeCamera = (index: number) => {
    setCameras((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCamera = (index: number, field: keyof CameraConfig, value: string) => {
    setCameras((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const updateCameraName = (index: number, name: string) => {
    setCameras((prev) =>
      prev.map((c, i) => {
        if (i === index) {
          return { ...c, name };
        }
        return c;
      })
    );
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const filePath = `completion-form_${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      setCompletionFormImageUrl(urlData.publicUrl);
      toast.success("Image uploaded successfully!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const removeCompletionImage = () => {
    setCompletionFormImageUrl(null);
  };

  const handleDownloadCompletionForm = () => {
    if (!completionFormImageUrl) return;

    const link = document.createElement("a");
    link.href = completionFormImageUrl;
    link.download = `completion-form-${new Date().toISOString().split("T")[0]}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downloading completion form...");
  };

  const autoFillCertificate = () => {
    if (!millName || !millLocation) {
      toast.error("Please fill Mill Name and Mill Location first");
      return;
    }
    // Auto-fill company name and address from site data
    setShowCertificateForm(true);
    // Keep name/designation/signature empty for manual input
    const today = new Date().toISOString().split("T")[0];
    setCertClientDate(today);
    setCertDeploymentDate(dateInput || today);
    setCertIssmDate(today);
    toast.success("Certificate auto-filled! Please complete remaining fields");
  };

  const saveCertificate = async () => {
    if (!id) {
      toast.error("Please save the site first before saving certificate");
      return;
    }

    if (!certClientName || !certIssmName) {
      toast.error("Please fill in Client Name and ISSM Name");
      return;
    }

    setSavingCertificate(true);
    try {
      // Use selected profile or first available profile
      const profileToUse = selectedProfileForDownload
        ? allProfiles.find(p => p.id === selectedProfileForDownload)
        : allProfiles[0];

      const certificate: DeploymentCertificate = {
        site_id: id,
        company_name: millName,
        site_address: millLocation,
        client_name: certClientName,
        client_designation: certClientDesignation,
        client_date: certClientDate,
        deployment_date: certDeploymentDate,
        issm_name: certIssmName,
        issm_designation: certIssmDesignation,
        issm_date: certIssmDate,
        companyProfileId: profileToUse?.id,
        companyProfileName: profileToUse?.company_name,
        certificate_type: certificateType,
      };

      await deploymentCertificateAPI.create(certificate);
      toast.success("Certificate saved successfully!");

      // Reload certificates (with error handling for missing index)
      try {
        const updatedCerts = await deploymentCertificateAPI.getBySiteId(id);
        setCertificates(updatedCerts);
      } catch (error) {
        console.error("Error reloading certificates:", error);
        // Still reset the form even if reload fails
      }

      clearCertificateFormData(id);
      // Reset form
      setShowCertificateForm(false);
      setCertClientName("");
      setCertClientDesignation("");
      setCertIssmName("");
      setCertIssmDesignation("");
    } catch (error: any) {
      toast.error(error.message || "Failed to save certificate");
    } finally {
      setSavingCertificate(false);
    }
  };

  const generateAndDownloadPDF = async () => {
    if (!certClientName || !certIssmName) {
      toast.error("Please fill in Client Name and ISSM Name");
      return;
    }

    if (allProfiles.length === 0) {
      toast.error("No company profiles available. Please create a profile first.");
      return;
    }

    // Always show dialog to let user select/confirm company profile
    setDownloadAction("download");
    setSelectedProfileForDownload(allProfiles[0]?.id || "");
    setShowProfileSelectDialog(true);
  };

  const printCertificate = async () => {
    if (!certClientName || !certIssmName) {
      toast.error("Please fill in Client Name and ISSM Name");
      return;
    }

    if (allProfiles.length === 0) {
      toast.error("No company profiles available. Please create a profile first.");
      return;
    }

    // Always show dialog to let user select/confirm company profile
    setDownloadAction("print");
    setSelectedProfileForDownload(allProfiles[0]?.id || "");
    setShowProfileSelectDialog(true);
  };

  const performDownload = async (action: "download" | "print") => {
    try {
      const selectedProfile = allProfiles.find(p => p.id === selectedProfileForDownload);
      if (!selectedProfile) {
        toast.error("Please select a company profile");
        return;
      }

      if (action === "download") {
        await downloadDeploymentCertificatePDF(
          millName,
          millLocation,
          certClientName,
          certClientDesignation,
          certClientDate,
          certDeploymentDate,
          certIssmName,
          certIssmDesignation,
          certIssmDate,
          selectedProfile?.logo_url,
          selectedProfile?.logo_url,
          selectedProfile?.id,
          certificateType
        );
        toast.success("Certificate PDF downloaded!");
      } else {
        await printDeploymentCertificate(
          millName,
          millLocation,
          certClientName,
          certClientDesignation,
          certClientDate,
          certDeploymentDate,
          certIssmName,
          certIssmDesignation,
          certIssmDate,
          selectedProfile?.logo_url,
          selectedProfile?.logo_url,
          selectedProfile?.id,
          certificateType
        );
        toast.success("Opening print dialog...");
      }

      setShowProfileSelectDialog(false);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action === "download" ? "download" : "print"} certificate`);
    }
  };

  const startEditCertificate = (cert: DeploymentCertificate) => {
    setEditingCertId(cert.id || null);
    setEditingCertData({
      client_name: cert.client_name,
      client_designation: cert.client_designation,
      client_date: cert.client_date,
      deployment_date: cert.deployment_date || cert.client_date,
      issm_name: cert.issm_name,
      issm_designation: cert.issm_designation,
      issm_date: cert.issm_date,
    });
  };

  const cancelEditCertificate = () => {
    setEditingCertId(null);
    setEditingCertData({});
  };

  const saveCertificateEdit = async () => {
    if (!editingCertId) return;

    try {
      setUpdatingCert(true);
      await deploymentCertificateAPI.update(editingCertId, editingCertData);

      // Reload certificates (with error handling for missing index)
      try {
        const updatedCerts = await deploymentCertificateAPI.getBySiteId(id!);
        setCertificates(updatedCerts);
      } catch (error) {
        console.error("Error reloading certificates:", error);
        // Update the local state without reloading from DB
        setCertificates(prev =>
          prev.map(c => c.id === editingCertId ? { ...c, ...editingCertData } : c)
        );
      }

      toast.success("Certificate updated successfully");
      setEditingCertId(null);
      setEditingCertData({});
    } catch (error: any) {
      toast.error(error.message || "Failed to update certificate");
    } finally {
      setUpdatingCert(false);
    }
  };

  const deleteCertificate = async (certId: string) => {
    if (!window.confirm("Are you sure you want to delete this certificate?")) {
      return;
    }

    try {
      await deploymentCertificateAPI.delete(certId);

      // Update local state immediately
      setCertificates(prev => prev.filter(c => c.id !== certId));

      // Try to reload from DB (with error handling for missing index)
      try {
        const updatedCerts = await deploymentCertificateAPI.getBySiteId(id!);
        setCertificates(updatedCerts);
      } catch (error) {
        console.error("Error reloading certificates:", error);
        // Keep the locally updated state
      }

      toast.success("Certificate deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete certificate");
    }
  };

  const downloadCertificatePDF = async (cert: DeploymentCertificate) => {
    try {
      const profileId = cert.companyProfileId || selectedProfileForDownload;
      if (!profileId) {
        toast.error("Company profile not found");
        return;
      }

      await downloadDeploymentCertificatePDF(
        cert.company_name,
        cert.site_address,
        cert.client_name,
        cert.client_designation,
        cert.client_date,
        cert.deployment_date || cert.client_date,
        cert.issm_name,
        cert.issm_designation,
        cert.issm_date,
        cert.company_stamp_url,
        undefined,
        profileId,
        cert.certificate_type || "digital-eye"
      );
      toast.success("Certificate PDF downloaded!");
    } catch (error: any) {
      toast.error(error.message || "Failed to download certificate");
    }
  };

  const printCertificatePDF = async (cert: DeploymentCertificate) => {
    try {
      const profileId = cert.companyProfileId || selectedProfileForDownload;
      if (!profileId) {
        toast.error("Company profile not found");
        return;
      }

      await printDeploymentCertificate(
        cert.company_name,
        cert.site_address,
        cert.client_name,
        cert.client_designation,
        cert.client_date,
        cert.deployment_date || cert.client_date,
        cert.issm_name,
        cert.issm_designation,
        cert.issm_date,
        cert.company_stamp_url,
        undefined,
        profileId,
        cert.certificate_type || "digital-eye"
      );
      toast.success("Opening print dialog...");
    } catch (error: any) {
      toast.error(error.message || "Failed to print certificate");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => {
          if (technicalProjectId) {
            navigate(`/technical-projects/${technicalProjectId}`);
          } else {
            navigate("/sites");
          }
        }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {id ? "Edit Site Details" : "New Site Details"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage site information and credentials
          </p>
        </div>
      </div>

      {/* Supervisor and Technician Information - At Top */}
      <Card>
        <CardHeader>
          <CardTitle>Personnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supervisor-name">Supervisor Name</Label>
              <Input
                id="supervisor-name"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="Enter supervisor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="technician-name">Technician Name</Label>
              <Input
                id="technician-name"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Enter technician name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Site Information */}
      <Card>
        <CardHeader>
          <CardTitle>Site Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mill-name">Mill Name *</Label>
              <Input
                id="mill-name"
                value={millName}
                onChange={(e) => setMillName(e.target.value)}
                placeholder="Enter mill name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mill-location">Mill Location</Label>
              <Input
                id="mill-location"
                value={millLocation}
                onChange={(e) => setMillLocation(e.target.value)}
                placeholder="Enter mill location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-no">Unit No</Label>
              <Input
                id="unit-no"
                value={unitNo}
                onChange={(e) => setUnitNo(e.target.value)}
                placeholder="Enter unit number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poc-name">POC Name</Label>
              <Input
                id="poc-name"
                value={pocName}
                onChange={(e) => setPocName(e.target.value)}
                placeholder="Enter POC name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poc-contact">POC Contact</Label>
              <Input
                id="poc-contact"
                value={pocContact}
                onChange={(e) => setPocContact(e.target.value)}
                placeholder="Enter POC contact"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GPU Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>GPU Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gpu-user">GPU User Name</Label>
              <Input
                id="gpu-user"
                value={gpuUserName}
                onChange={(e) => setGpuUserName(e.target.value)}
                placeholder="Enter GPU username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gpu-pass">GPU Password</Label>
              <Input
                id="gpu-pass"
                type="text"
                value={gpuPassword}
                onChange={(e) => setGpuPassword(e.target.value)}
                placeholder="sonicgpu786"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remote AnyDesk Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Remote AnyDesk Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AnyDesk Credentials Set 1 */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="anydesk-id">AnyDesk ID 1</Label>
                <Input
                  id="anydesk-id"
                  value={anydeskId}
                  onChange={(e) => setAnydeskId(e.target.value)}
                  placeholder="Enter AnyDesk ID 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anydesk-pass">AnyDesk Password 1</Label>
                <Input
                  id="anydesk-pass"
                  type="text"
                  value={anydeskPassword}
                  onChange={(e) => setAnydeskPassword(e.target.value)}
                  placeholder="sonicgpu786"
                />
              </div>
            </div>
          </div>

          {/* AnyDesk Credentials Set 2 */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="anydesk-id2">AnyDesk ID 2</Label>
                <Input
                  id="anydesk-id2"
                  value={anydeskId2}
                  onChange={(e) => setAnydeskId2(e.target.value)}
                  placeholder="Enter AnyDesk ID 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anydesk-pass2">AnyDesk Password 2</Label>
                <Input
                  id="anydesk-pass2"
                  type="text"
                  value={anydeskPassword2}
                  onChange={(e) => setAnydeskPassword2(e.target.value)}
                  placeholder="sonicgpu786"
                />
              </div>
            </div>
          </div>

          {/* Additional Remote Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Additional Remote Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tailscale-ip">Tail Scale IP</Label>
                <Input
                  id="tailscale-ip"
                  value={tailscaleIp}
                  onChange={(e) => setTailscaleIp(e.target.value)}
                  placeholder="Enter Tail Scale IP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-anydesk-pass">Password</Label>
                <Input
                  id="remote-anydesk-pass"
                  type="text"
                  value={remoteanydeskPassword}
                  onChange={(e) => setRemoteanydeskPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-anydesk-account">Account Name</Label>
                <Input
                  id="remote-anydesk-account"
                  value={remoteanydeskAccountName}
                  onChange={(e) => setRemoteanydeskAccountName(e.target.value)}
                  placeholder="Enter account name"
                />
              </div>
            </div>
          </div>

          {/* RustDesk Credentials Set 1 */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rustdesk-id">RustDesk ID 1</Label>
                <Input
                  id="rustdesk-id"
                  value={rustdeskId}
                  onChange={(e) => setRustdeskId(e.target.value)}
                  placeholder="Enter RustDesk ID 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rustdesk-password">RustDesk Password 1</Label>
                <Input
                  id="rustdesk-password"
                  type="text"
                  value={rustdeskPassword}
                  onChange={(e) => setRustdeskPassword(e.target.value)}
                  placeholder="Enter RustDesk password 1"
                />
              </div>
            </div>
          </div>

          {/* RustDesk Credentials Set 2 */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rustdesk-id2">RustDesk ID 2</Label>
                <Input
                  id="rustdesk-id2"
                  value={rustdeskId2}
                  onChange={(e) => setRustdeskId2(e.target.value)}
                  placeholder="Enter RustDesk ID 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rustdesk-password2">RustDesk Password 2</Label>
                <Input
                  id="rustdesk-password2"
                  type="text"
                  value={rustdeskPassword2}
                  onChange={(e) => setRustdeskPassword2(e.target.value)}
                  placeholder="Enter RustDesk password 2"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Network Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pc-nic">PC NIC</Label>
              <Input
                id="pc-nic"
                value={pcNic}
                onChange={(e) => setPcNic(e.target.value)}
                placeholder="Enter PC NIC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subnet">Subnet</Label>
              <Input
                id="subnet"
                value={subnet}
                onChange={(e) => setSubnet(e.target.value)}
                placeholder="Enter subnet mask"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gateway">Default Gateway</Label>
              <Input
                id="gateway"
                value={defaultGateway}
                onChange={(e) => setDefaultGateway(e.target.value)}
                placeholder="Enter default gateway"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dns">DNS</Label>
              <Input
                id="dns"
                value={dns}
                onChange={(e) => setDns(e.target.value)}
                placeholder="Enter DNS"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="live-ip">Live IP</Label>
              <Input
                id="live-ip"
                value={liveIp}
                onChange={(e) => setLiveIp(e.target.value)}
                placeholder="Enter Live IP"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NVR Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>NVR Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nvr-ip">NVR IP</Label>
              <Input
                id="nvr-ip"
                value={nvrIp}
                onChange={(e) => setNvrIp(e.target.value)}
                placeholder="Enter NVR IP address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nvr-port">Port</Label>
              <Input
                id="nvr-port"
                value={nvrPort}
                onChange={(e) => setNvrPort(e.target.value)}
                placeholder="Enter NVR port"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nvr-user">Username</Label>
              <Input
                id="nvr-user"
                value={nvrUsername}
                onChange={(e) => setNvrUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nvr-pass">Password</Label>
              <Input
                id="nvr-pass"
                type="text"
                value={nvrPassword}
                onChange={(e) => setNvrPassword(e.target.value)}
                placeholder="sonicnvr786"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Camera Configuration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Camera Configuration</CardTitle>
          <Button onClick={addCamera} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Camera
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Global camera credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="camera-user">Camera Username (for all cameras)</Label>
              <Input
                id="camera-user"
                value={cameraUsername}
                onChange={(e) => setCameraUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="camera-pass">Camera Password (for all cameras)</Label>
              <Input
                id="camera-pass"
                type="text"
                value={cameraPassword}
                onChange={(e) => setCameraPassword(e.target.value)}
                placeholder="soniccam786"
              />
            </div>
          </div>

          {/* Individual cameras */}
          <div className="space-y-4">
            {cameras.map((camera, index) => (
              <div key={camera.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm font-medium">Camera Name</Label>
                    <Input
                      value={camera.name}
                      onChange={(e) => updateCameraName(index, e.target.value)}
                      placeholder={`Camera ${index + 1}`}
                      className="font-medium"
                    />
                  </div>
                  {cameras.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCamera(index)}
                      className="text-red-600 mt-6 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Camera IP</Label>
                  <Input
                    value={camera.ip || ""}
                    onChange={(e) => updateCamera(index, "ip", e.target.value)}
                    placeholder={`Camera ${index + 1} IP address`}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Addition */}
      <Card>
        <CardHeader>
          <CardTitle>Addition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addition">Additional Notes</Label>
            <textarea
              id="addition"
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              placeholder="Add any additional information..."
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Completion Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Completion Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
              <Checkbox
                checked={hardwareCompleted}
                onCheckedChange={(checked) => setHardwareCompleted(checked === true)}
              />
              <span className="text-sm font-medium">Hardware Completed</span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
              <Checkbox
                checked={dataCopy}
                onCheckedChange={(checked) => setDataCopy(checked === true)}
              />
              <span className="text-sm font-medium">Data Copy</span>
            </label>
            <div className="space-y-2">
              <Label htmlFor="patch-1-date">Patch 1 Date</Label>
              <Input
                id="patch-1-date"
                type="date"
                value={patch1Date}
                onChange={(e) => setPatch1Date(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patch-2-date">Patch 2 Date</Label>
              <Input
                id="patch-2-date"
                type="date"
                value={patch2Date}
                onChange={(e) => setPatch2Date(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
              <Checkbox
                checked={completionCertificate}
                onCheckedChange={(checked) => setCompletionCertificate(checked === true)}
              />
              <span className="text-sm font-medium">Completion Certificate</span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
              <Checkbox
                checked={roiCreated}
                onCheckedChange={(checked) => setRoiCreated(checked === true)}
              />
              <span className="text-sm font-medium">ROI Created</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Completion Form - Image Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Completion Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {completionFormImageUrl && (
            <div className="space-y-3">
              <div className="relative inline-block">
                <img
                  src={completionFormImageUrl}
                  alt="Completion Form"
                  className="h-48 w-auto rounded-lg border-2 border-border object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeCompletionImage}
                  className="absolute -top-2 -right-2 bg-destructive text-white hover:bg-destructive/90"
                  disabled={uploadingImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCompletionForm}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <label className="cursor-pointer flex-1">
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
                disabled={uploadingImage}
                ref={fileInputRef}
              />
              <Button variant="outline" size="sm" asChild disabled={uploadingImage} className="w-full">
                <span className="gap-2">
                  {uploadingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Image
                    </>
                  )}
                </span>
              </Button>
            </label>
            <label className="cursor-pointer flex-1">
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraCapture}
                disabled={uploadingImage}
                ref={cameraInputRef}
              />
              <Button variant="outline" size="sm" asChild disabled={uploadingImage} className="w-full">
                <span className="gap-2">
                  <Camera className="h-4 w-4" />
                  Take Photo
                </span>
              </Button>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG or GIF · Max 5 MB</p>
        </CardContent>
      </Card>

      {/* Deployment Certificate Section */}
      {id && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Deployment Certificates
                {certificates.length > 0 && (
                  <span className="ml-2 text-sm font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {certificates.length} {certificates.length === 1 ? "certificate" : "certificates"}
                  </span>
                )}
              </CardTitle>
              {!showCertificateForm && (
                <Button onClick={() => {
                  const savedData = loadCertificateFormData(id!);
                  if (savedData) {
                    setCertClientName(savedData.certClientName || "");
                    setCertClientDesignation(savedData.certClientDesignation || "");
                    setCertClientDate(savedData.certClientDate || new Date().toISOString().split("T")[0]);
                    setCertDeploymentDate(savedData.certDeploymentDate || new Date().toISOString().split("T")[0]);
                    setCertIssmName(savedData.certIssmName || "");
                    setCertIssmDesignation(savedData.certIssmDesignation || "");
                    setCertIssmDate(savedData.certIssmDate || new Date().toISOString().split("T")[0]);
                    setCertificateType(savedData.certificateType || "digital-eye");
                  }
                  setShowCertificateForm(true);
                }} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Certificate
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Display Created Certificates */}
            {loadingCertificates && (
              <div className="text-center py-4 text-muted-foreground">
                Loading certificates...
              </div>
            )}

            {!loadingCertificates && certificates.length > 0 && (
              <div className="space-y-4 border-b pb-6">
                <h4 className="font-semibold text-sm">Saved Certificates</h4>
                {certificates.map((cert) => (
                  <div key={cert.id} className="border rounded-lg p-4 space-y-4">
                    {editingCertId === cert.id ? (
                      // Edit mode
                      <div className="space-y-4">
                        <h5 className="font-medium text-sm">Edit Certificate</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-client-name">Client Name</Label>
                            <Input
                              id="edit-client-name"
                              value={editingCertData.client_name || ""}
                              onChange={(e) =>
                                setEditingCertData({ ...editingCertData, client_name: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-client-designation">Client Designation</Label>
                            <Input
                              id="edit-client-designation"
                              value={editingCertData.client_designation || ""}
                              onChange={(e) =>
                                setEditingCertData({ ...editingCertData, client_designation: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-client-date">Client Date</Label>
                            <Input
                              id="edit-client-date"
                              type="date"
                              value={editingCertData.client_date || ""}
                              onChange={(e) =>
                                setEditingCertData({ ...editingCertData, client_date: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-deployment-date">Deployment Date</Label>
                            <Input
                              id="edit-deployment-date"
                              type="date"
                              value={editingCertData.deployment_date || ""}
                              onChange={(e) =>
                                setEditingCertData({ ...editingCertData, deployment_date: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-issm-name">ISSM Name</Label>
                            <Input
                              id="edit-issm-name"
                              value={editingCertData.issm_name || ""}
                              onChange={(e) =>
                                setEditingCertData({ ...editingCertData, issm_name: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-issm-designation">ISSM Designation</Label>
                            <Input
                              id="edit-issm-designation"
                              value={editingCertData.issm_designation || ""}
                              onChange={(e) =>
                                setEditingCertData({ ...editingCertData, issm_designation: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-issm-date">ISSM Date</Label>
                            <Input
                              id="edit-issm-date"
                              type="date"
                              value={editingCertData.issm_date || ""}
                              onChange={(e) =>
                                setEditingCertData({ ...editingCertData, issm_date: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={cancelEditCertificate}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={saveCertificateEdit}
                            disabled={updatingCert}
                            className="flex-1"
                          >
                            {updatingCert ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-semibold text-foreground">Client</p>
                            <p className="text-muted-foreground">{cert.client_name}</p>
                            <p className="text-xs text-muted-foreground">{cert.client_designation}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(cert.client_date).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Deployment: {new Date(cert.deployment_date || cert.client_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">ISSM</p>
                            <p className="text-muted-foreground">{cert.issm_name}</p>
                            <p className="text-xs text-muted-foreground">{cert.issm_designation}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(cert.issm_date).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Type: {cert.certificate_type === "digital-eye" ? "Digital Eye" : "Uqaab"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            variant="outline"
                            onClick={() => downloadCertificatePDF(cert)}
                            className="flex-1 gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download PDF
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => printCertificatePDF(cert)}
                            className="flex-1 gap-2"
                          >
                            <Printer className="h-4 w-4" />
                            Print
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => startEditCertificate(cert)}
                            className="flex-1 gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => deleteCertificate(cert.id!)}
                            className="flex-1 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Create New Certificate Form */}
            {showCertificateForm && (
              <div className="space-y-4 border-t pt-4">
                {/* Certificate Type Selection */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Certificate Type *</h4>
                  <RadioGroup value={certificateType} onValueChange={(value) => setCertificateType(value as "digital-eye" | "uqaab")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="digital-eye" id="digital-eye" />
                      <Label htmlFor="digital-eye" className="cursor-pointer font-normal">Digital Eye</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="uqaab" id="uqaab" />
                      <Label htmlFor="uqaab" className="cursor-pointer font-normal">Obsidian</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Auto-fill button */}
                <Button
                  variant="outline"
                  onClick={autoFillCertificate}
                  className="w-full"
                  type="button"
                >
                  Auto Fill with Site Data
                </Button>

                {/* Client Information */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Client Information (Textile Mill)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cert-client-name">Client Name *</Label>
                      <Input
                        id="cert-client-name"
                        value={certClientName}
                        onChange={(e) => setCertClientName(e.target.value)}
                        placeholder="Enter client name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cert-client-designation">Designation</Label>
                      <Input
                        id="cert-client-designation"
                        value={certClientDesignation}
                        onChange={(e) => setCertClientDesignation(e.target.value)}
                        placeholder="Enter designation"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cert-client-date">Date</Label>
                      <Input
                        id="cert-client-date"
                        type="date"
                        value={certClientDate}
                        onChange={(e) => setCertClientDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cert-deployment-date">Deployment Date</Label>
                      <Input
                        id="cert-deployment-date"
                        type="date"
                        value={certDeploymentDate}
                        onChange={(e) => setCertDeploymentDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* ISSM Information */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">{certificateType === "digital-eye" ? "ISSM Labelling Solutions" : "Obsidian"}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cert-issm-name">{certificateType === "digital-eye" ? "ISSM Name" : "Obsidian Name"} *</Label>
                      <Input
                        id="cert-issm-name"
                        value={certIssmName}
                        onChange={(e) => setCertIssmName(e.target.value)}
                        placeholder={certificateType === "digital-eye" ? "Enter ISSM representative name" : "Enter Obsidian name"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cert-issm-designation">{certificateType === "digital-eye" ? "ISSM Designation" : "Obsidian Designation"}</Label>
                      <Input
                        id="cert-issm-designation"
                        value={certIssmDesignation}
                        onChange={(e) => setCertIssmDesignation(e.target.value)}
                        placeholder="Enter designation"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cert-issm-date">{certificateType === "digital-eye" ? "ISSM Date" : "Obsidian Date"}</Label>
                      <Input
                        id="cert-issm-date"
                        type="date"
                        value={certIssmDate}
                        onChange={(e) => setCertIssmDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons for Certificate */}
                <div className="flex flex-col sm:flex-row gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCertificateForm(false);
                      setCertClientName("");
                      setCertClientDesignation("");
                      setCertDeploymentDate(dateInput || new Date().toISOString().split("T")[0]);
                      setCertIssmName("");
                      setCertIssmDesignation("");
                      setCertificateType("digital-eye");
                    }}
                    type="button"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={generateAndDownloadPDF}
                    disabled={!certClientName || !certIssmName}
                    type="button"
                    className="flex-1 gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={printCertificate}
                    disabled={!certClientName || !certIssmName}
                    type="button"
                    className="flex-1 gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                  <Button
                    onClick={saveCertificate}
                    disabled={savingCertificate || !certClientName || !certIssmName}
                    type="button"
                    className="flex-1"
                  >
                    {savingCertificate ? "Saving..." : "Save Record"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate("/sites")}
        >
          Cancel
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !millName}
        >
          {saveMutation.isPending ? "Saving..." : id ? "Update Site" : "Create Site"}
        </Button>
      </div>

      {/* Company Profile Selection Dialog for Certificate Download/Print */}
      <Dialog open={showProfileSelectDialog} onOpenChange={setShowProfileSelectDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Company Profile</DialogTitle>
            <DialogDescription>
              Choose which company profile to use for this deployment certificate:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {allProfiles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No company profiles found. Please create one in Settings.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allProfiles.map((profile) => (
                  <Button
                    key={profile.id}
                    variant={selectedProfileForDownload === profile.id ? "default" : "outline"}
                    className="w-full justify-start transition-colors"
                    onClick={() => setSelectedProfileForDownload(profile.id || "")}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {profile.logo_url && (
                        <img
                          src={profile.logo_url}
                          alt={profile.company_name}
                          className="h-8 w-8 rounded object-contain bg-muted p-1"
                          loading="lazy"
                        />
                      )}
                      <div className="text-left">
                        <p className="font-medium text-sm">{profile.company_name}</p>
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowProfileSelectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => performDownload(downloadAction)}
              disabled={allProfiles.length === 0 || !selectedProfileForDownload}
            >
              {downloadAction === "download" ? "Download PDF" : "Print"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Form Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Completion Form Preview</DialogTitle>
          </DialogHeader>
          <div className="max-h-[600px] overflow-auto">
            {completionFormImageUrl && (
              <img
                src={completionFormImageUrl}
                alt="Completion Form Preview"
                className="w-full rounded-lg border border-border"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={handleDownloadCompletionForm}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
