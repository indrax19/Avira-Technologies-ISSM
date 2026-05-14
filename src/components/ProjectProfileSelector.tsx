import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { companyProfileAPI } from "@/integrations/firebase/firestore";
import { toast } from "sonner";
import { Building2, Loader2, CheckCircle2 } from "lucide-react";

interface CompanyProfile {
  id: string;
  company_name?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
}

interface ProjectProfileSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (profileId: string) => void;
}

export function ProjectProfileSelector({
  open,
  onOpenChange,
  onSelect,
}: ProjectProfileSelectorProps) {
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadProfiles();
    }
  }, [open]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const allProfiles = await companyProfileAPI.getAll();
      setProfiles(allProfiles);
      if (allProfiles.length > 0) {
        setSelectedId(allProfiles[0].id);
      }
    } catch (error) {
      console.error("Failed to load company profiles:", error);
      toast.error("Failed to load company profiles");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedId) {
      onSelect(selectedId);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="border-b pb-6">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-3 rounded-lg">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>
            Select Company Profile
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
              <p className="text-sm text-gray-600">Loading profiles...</p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600">No company profiles found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  onClick={() => setSelectedId(profile.id)}
                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    selectedId === profile.id
                      ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100"
                      : "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {profile.logo_url ? (
                      <img
                        src={profile.logo_url}
                        alt={profile.company_name}
                        className="h-12 w-12 rounded-lg object-contain bg-white p-2 border border-gray-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-6 w-6 text-emerald-600" />
                      </div>
                    )}
                    
                    <div className="flex-grow min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">
                        {profile.company_name || "Company"}
                      </p>
                      {profile.email && (
                        <p className="text-xs text-gray-600 mt-1">{profile.email}</p>
                      )}
                      {profile.phone && (
                        <p className="text-xs text-gray-600">{profile.phone}</p>
                      )}
                    </div>

                    {selectedId === profile.id && (
                      <div className="flex-shrink-0 mt-1">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedId || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
