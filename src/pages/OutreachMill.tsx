import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Building2, Download, FileUp, Loader2, MessageSquarePlus, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { outreachMillsAPI, type OutreachMill, type OutreachRemark } from "@/integrations/firebase/outreachMillsAPI";
import { parentProjectsAPI, type ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { projectTrackingAPI } from "@/integrations/firebase/projectTrackingAPI";

const emptyMill = (): Omit<OutreachMill, "id" | "created_at" | "updated_at"> => ({
  spinningMill: "",
  city: "",
  address: "",
  phone: "",
  email: "",
  pocName: "",
  pocNumber: "",
  pocEmail: "",
  notes: "",
  remarks: [],
});

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const importValue = (row: Record<string, unknown>, names: string[]) => {
  const entry = Object.entries(row).find(([key]) => names.includes(normalizeKey(key)));
  return entry?.[1] == null ? "" : String(entry[1]).trim();
};

export default function OutreachMill() {
  const { appUser } = useAuth();
  const [mills, setMills] = useState<OutreachMill[]>([]);
  const [projects, setProjects] = useState<ParentProject[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingMill, setEditingMill] = useState<OutreachMill | null>(null);
  const [form, setForm] = useState(emptyMill());
  const [remarksMill, setRemarksMill] = useState<OutreachMill | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [transferMill, setTransferMill] = useState<OutreachMill | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => outreachMillsAPI.subscribeAll(setMills, () => toast.error("Unable to load outreach mills.")), []);
  useEffect(() => parentProjectsAPI.subscribeAll(setProjects, () => toast.error("Unable to load project categories.")), []);

  const filteredMills = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return mills;
    return mills.filter((mill) => [mill.spinningMill, mill.city, mill.pocName, mill.email, mill.pocNumber].some((value) => value?.toLowerCase().includes(needle)));
  }, [mills, search]);

  const saveMill = useMutation({
    mutationFn: async () => {
      if (!form.spinningMill.trim()) throw new Error("Spinning Mill is required");
      const data = { ...form, spinningMill: form.spinningMill.trim(), created_by: appUser?.id };
      if (editingMill?.id) await outreachMillsAPI.update(editingMill.id, data);
      else await outreachMillsAPI.create(data);
    },
    onSuccess: () => {
      toast.success(editingMill ? "Mill updated" : "Mill added to outreach");
      closeForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addRemark = useMutation({
    mutationFn: async () => {
      if (!remarksMill?.id || !remarkText.trim()) throw new Error("Enter a remark first");
      const nextRemark: OutreachRemark = { id: crypto.randomUUID(), text: remarkText.trim(), createdAt: new Date().toISOString(), createdBy: appUser?.fullName };
      await outreachMillsAPI.update(remarksMill.id, { remarks: [...(remarksMill.remarks || []), nextRemark] });
    },
    onSuccess: () => {
      toast.success("Remark saved to history");
      setRemarkText("");
      setRemarksMill(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transferMillMutation = useMutation({
    mutationFn: async () => {
      if (!transferMill?.id || !selectedProjectId) throw new Error("Select a project category");
      const today = new Date().toISOString().slice(0, 10);
      await projectTrackingAPI.create({
        project_id: selectedProjectId,
        millName: transferMill.spinningMill,
        city: transferMill.city || "Not specified",
        district: transferMill.city || "Not specified",
        address: transferMill.address,
        pocName: transferMill.pocName || "Not specified",
        pocPhone: transferMill.pocNumber || transferMill.phone || "Not specified",
        projectStatus: "Not Yet Started",
        supplierName: "",
        logisticsStatus: "Pending Dispatch",
        poStatus: "Pending",
        poDate: today,
        startDate: today,
        endDate: today,
        supervisorName: "",
        technicianNames: [],
        teamStatus: "Scheduled",
        hardwareStatus: "",
        hardwareDeliveryStatus: "Pending Dispatch",
      });
      await outreachMillsAPI.update(transferMill.id, { transferredProjectId: selectedProjectId, transferredAt: new Date().toISOString() });
    },
    onSuccess: () => {
      toast.success("Mill transferred to Project Tracking");
      setTransferMill(null);
      setSelectedProjectId("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMill = useMutation({
    mutationFn: (id: string) => outreachMillsAPI.delete(id),
    onSuccess: () => toast.success("Mill removed"),
    onError: () => toast.error("Unable to remove mill"),
  });

  function closeForm() {
    setFormOpen(false);
    setEditingMill(null);
    setForm(emptyMill());
  }

  function openEdit(mill: OutreachMill) {
    setEditingMill(mill);
    setForm({ ...emptyMill(), ...mill, remarks: mill.remarks || [] });
    setFormOpen(true);
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const contacts = rows
          .map((row) => ({
            spinningMill: importValue(row, ["spinningmill", "mill", "millname"]),
            city: importValue(row, ["city"]),
            address: importValue(row, ["address"]),
            phone: importValue(row, ["phone", "phonenumber", "contactnumber"]),
            email: importValue(row, ["email", "millmail"]),
            pocName: importValue(row, ["pocname", "contactperson", "pointofcontact"]),
            pocNumber: importValue(row, ["pocnumber", "pocphone", "poccontact"]),
            pocEmail: importValue(row, ["pocmail", "pocemail"]),
            notes: importValue(row, ["notes", "note"]),
            remarks: [],
            created_by: appUser?.id,
          }))
          .filter((contact) => contact.spinningMill);
        if (!contacts.length) throw new Error("No Spinning Mill column data was found");
        await Promise.all(contacts.map((contact) => outreachMillsAPI.create(contact)));
        toast.success(`${contacts.length} mill contacts imported`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Import failed");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadSampleExcel() {
    const sampleData = [
      {
        "Spinning Mill": "Sample Textile Mills Ltd",
        "City": "Ahmedabad",
        "Address": "123 Industrial Zone, Ahmedabad",
        "Phone": "+91-9876543210",
        "Email": "contact@sampletextile.com",
        "POC Name": "Rajesh Kumar",
        "POC Number": "+91-9876543211",
        "POC Email": "rajesh@sampletextile.com",
        "Notes": "Large spinning mill with 500+ spindles"
      },
      {
        "Spinning Mill": "Premier Spinning Company",
        "City": "Surat",
        "Address": "456 Business Park, Surat",
        "Phone": "+91-8765432109",
        "Email": "info@premierspinning.com",
        "POC Name": "Priya Sharma",
        "POC Number": "+91-8765432110",
        "POC Email": "priya@premierspinning.com",
        "Notes": "Medium-sized mill focused on premium yarns"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 35 },
      { wch: 18 },
      { wch: 25 },
      { wch: 20 },
      { wch: 18 },
      { wch: 25 },
      { wch: 35 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mills");
    XLSX.writeFile(wb, "outreach_mill_sample.xlsx");
    toast.success("Sample Excel file downloaded");
  }

  function downloadMillsAsExcel() {
    if (filteredMills.length === 0) {
      toast.error("No mills to export");
      return;
    }

    const exportData = filteredMills.map((mill) => ({
      "Spinning Mill": mill.spinningMill,
      "City": mill.city || "—",
      "Address": mill.address || "—",
      "Phone": mill.phone || "—",
      "Email": mill.email || "—",
      "POC Name": mill.pocName || "—",
      "POC Number": mill.pocNumber || "—",
      "POC Email": mill.pocEmail || "—",
      "Notes": mill.notes || "—",
      "Remarks": mill.remarks?.length
        ? mill.remarks.map((remark) => `${remark.text} (${new Date(remark.createdAt).toLocaleString()})`).join("\n")
        : "—",
      "Remarks Count": mill.remarks?.length || 0,
      "Status": mill.transferredAt ? "Transferred" : "Active"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 35 },
      { wch: 18 },
      { wch: 25 },
      { wch: 20 },
      { wch: 18 },
      { wch: 25 },
      { wch: 35 },
      { wch: 50 },
      { wch: 15 },
      { wch: 15 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mills");
    XLSX.writeFile(wb, `outreach_mills_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${filteredMills.length} mill(s) exported`);
  }

  return (
    <div className="min-h-full bg-slate-50/70 p-4 md:p-8"><div className="mx-auto max-w-[1600px] space-y-7">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Lead management</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Outreach Mill</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage spinning-mill contacts, outreach notes, and project handovers from one focused workspace.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" className="h-10 border-slate-300 bg-white px-4 shadow-sm hover:bg-slate-50" onClick={downloadSampleExcel}><Download className="mr-2 h-4 w-4" />Download sample</Button>
          <Button variant="outline" className="h-10 border-slate-300 bg-white px-4 shadow-sm hover:bg-slate-50" onClick={() => uploadRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Import contacts</Button>
          <Button variant="outline" className="h-10 border-slate-300 bg-white px-4 shadow-sm hover:bg-slate-50" onClick={downloadMillsAsExcel}><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button className="h-10 bg-slate-950 px-4 shadow-sm hover:bg-slate-800" onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />Add mill</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-blue-100 p-3 text-blue-600"><Building2 className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Total mills</p><p className="text-2xl font-bold">{mills.length}</p></div></CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-amber-100 p-3 text-amber-600"><MessageSquarePlus className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Active outreach</p><p className="text-2xl font-bold">{mills.filter((mill) => !mill.transferredAt).length}</p></div></CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-600"><Send className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Transferred</p><p className="text-2xl font-bold">{mills.filter((mill) => mill.transferredAt).length}</p></div></CardContent></Card>
      </div>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-4 border-b border-slate-100 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-lg text-slate-950">Mill contacts</CardTitle><p className="mt-1 text-sm text-slate-500">Keep contact details and follow-up history current.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mills or contacts" className="pl-9" /></div></CardHeader>
        <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="border-y border-slate-100 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-medium">Spinning Mill</th><th className="px-4 py-3 font-medium">City</th><th className="px-4 py-3 font-medium">Phone / Email</th><th className="px-4 py-3 font-medium">POC</th><th className="px-4 py-3 font-medium">Remarks</th><th className="px-4 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead><tbody>{filteredMills.map((mill) => <tr key={mill.id} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/30"><td className="px-5 py-4 font-semibold">{mill.spinningMill}<p className="mt-1 max-w-64 truncate font-normal text-muted-foreground">{mill.address || "No address added"}</p></td><td className="px-4 py-4">{mill.city || "—"}</td><td className="px-4 py-4"><p>{mill.phone || "—"}</p><p className="mt-1 text-muted-foreground">{mill.email || "—"}</p></td><td className="px-4 py-4"><p>{mill.pocName || "—"}</p><p className="mt-1 text-muted-foreground">{mill.pocNumber || mill.pocEmail || "—"}</p></td><td className="px-4 py-4"><Button variant="outline" size="sm" onClick={() => setRemarksMill(mill)}>{mill.remarks?.length || 0} history</Button></td><td className="px-4 py-4"><span className={mill.transferredAt ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700" : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"}>{mill.transferredAt ? "Transferred" : "Outreach"}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(mill)} aria-label="Edit mill"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setRemarksMill(mill)} aria-label="Add remark"><MessageSquarePlus className="h-4 w-4" /></Button>{!mill.transferredAt && <Button variant="outline" size="sm" onClick={() => setTransferMill(mill)}><Send className="mr-1.5 h-3.5 w-3.5" />Transfer</Button>}<Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => mill.id && deleteMill.mutate(mill.id)} aria-label="Delete mill"><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{!filteredMills.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No mill contacts found. Add a mill or import the supplied spreadsheet.</td></tr>}</tbody></table></div></CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}><DialogContent className="max-h-[90vh] overflow-y-auto border-slate-200 p-0 shadow-2xl sm:max-w-3xl"><DialogHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-5"><DialogTitle className="text-xl text-slate-950">{editingMill ? "Edit outreach mill" : "Add outreach mill"}</DialogTitle><DialogDescription>Save the contact information for this spinning mill.</DialogDescription></DialogHeader><form onSubmit={(event: FormEvent) => { event.preventDefault(); saveMill.mutate(); }} className="space-y-6 px-6 py-6"><div className="grid gap-5 sm:grid-cols-2"><Field label="Spinning Mill *" value={form.spinningMill} onChange={(value) => updateField("spinningMill", value)} /><Field label="City" value={form.city || ""} onChange={(value) => updateField("city", value)} /><Field label="Phone" value={form.phone || ""} onChange={(value) => updateField("phone", value)} /><Field label="Email" type="email" value={form.email || ""} onChange={(value) => updateField("email", value)} /><Field label="POC Name" value={form.pocName || ""} onChange={(value) => updateField("pocName", value)} /><Field label="POC Number" value={form.pocNumber || ""} onChange={(value) => updateField("pocNumber", value)} /><Field label="POC Email" type="email" value={form.pocEmail || ""} onChange={(value) => updateField("pocEmail", value)} /><div className="sm:col-span-2"><Label>Address</Label><Textarea value={form.address || ""} onChange={(event) => updateField("address", event.target.value)} className="mt-2" /></div><div className="sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ""} onChange={(event) => updateField("notes", event.target.value)} className="mt-2" /></div></div><DialogFooter className="border-t border-slate-100 pt-5"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={saveMill.isPending}>{saveMill.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingMill ? "Save changes" : "Save mill"}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={!!remarksMill} onOpenChange={(open) => !open && setRemarksMill(null)}>
        <DialogContent className="w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto border-slate-200 p-0 shadow-2xl sm:w-full sm:max-w-2xl">
          <DialogHeader className="border-b border-slate-100 bg-slate-50/70 px-4 py-4 pr-12 sm:px-6 sm:py-5">
            <DialogTitle className="text-lg text-slate-950 sm:text-xl">Follow-up Remarks</DialogTitle>
            <DialogDescription className="mt-2 break-words text-sm font-semibold text-slate-700 sm:text-base">{remarksMill?.spinningMill}</DialogDescription>
            <p className="mt-1 text-xs text-slate-500">{remarksMill?.remarks?.length || 0} remarks in history</p>
          </DialogHeader>

          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">History</h3>
              <div className="max-h-56 space-y-3 overflow-y-auto pr-1 sm:max-h-72 sm:pr-2">
                {remarksMill?.remarks?.length ? (
                  [...(remarksMill.remarks || [])].reverse().map((remark) => (
                    <div key={remark.id} className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 transition-colors hover:bg-blue-50 sm:p-4">
                      <p className="break-words text-sm leading-relaxed text-slate-900">{remark.text}</p>
                      <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">{new Date(remark.createdAt).toLocaleString()}</p>
                        {remark.createdBy && <span className="max-w-full break-words rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">{remark.createdBy}</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">No remarks yet. Add your first follow-up below.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-200 pt-4">
              <label className="block text-sm font-semibold text-slate-900">Add Remark</label>
              <Textarea
                value={remarkText}
                onChange={(event) => setRemarkText(event.target.value)}
                placeholder="Document follow-up actions, status updates, or important notes..."
                className="min-h-24 resize-none border-slate-300"
              />
              <p className="text-xs text-slate-500">{remarkText.length} characters</p>
            </div>
          </div>

          <DialogFooter className="mt-0 flex-col-reverse gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button variant="outline" onClick={() => setRemarksMill(null)} className="w-full border-slate-300 sm:w-auto">
              Close
            </Button>
            <Button
              onClick={() => addRemark.mutate()}
              disabled={addRemark.isPending || !remarkText.trim()}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
            >
              {addRemark.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Remark
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferMill} onOpenChange={(open) => !open && setTransferMill(null)}><DialogContent><DialogHeader><DialogTitle>Transfer to Project Tracking</DialogTitle><DialogDescription>Select the project category where {transferMill?.spinningMill} should be added.</DialogDescription></DialogHeader><div className="space-y-2"><Label>Available project categories</Label><Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id!}>{project.name} ({project.projectType || "ISSM"})</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button variant="outline" onClick={() => setTransferMill(null)}>Cancel</Button><Button onClick={() => transferMillMutation.mutate()} disabled={transferMillMutation.isPending || !selectedProjectId}>{transferMillMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Transfer mill</Button></DialogFooter></DialogContent></Dialog>
    </div></div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2" /></div>;
}
