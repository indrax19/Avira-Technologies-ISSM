import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2, Loader2, Mail, MessageSquarePlus, Pencil, Plus, Search, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import PermissionDeniedDialog from "@/components/PermissionDeniedDialog";
import { useAuth } from "@/context/AuthContext";
import { customerDataAPI, type CustomerData, type CustomerRemark, type PointOfContact } from "@/integrations/firebase/customerDataAPI";

const sources = ["Social media", "Phone", "Email", "Reference"] as const;
const emptyPoc = (): PointOfContact => ({ id: crypto.randomUUID(), name: "", designation: "", email: "", mobile: "" });
const emptyCustomer = (): Omit<CustomerData, "id" | "created_at" | "updated_at"> => ({ customerName: "", organization: "", address: "", telephone: "", email: "", pocs: [emptyPoc()], source: "Social media", referenceName: "", remarks: [] });

export default function CustomerDataPage() {
  const { appUser, isAdmin } = useAuth();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [form, setForm] = useState(emptyCustomer());
  const [remarksCustomer, setRemarksCustomer] = useState<CustomerData | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CustomerData | null>(null);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);

  useEffect(() => customerDataAPI.subscribeAll(setCustomers, () => toast.error("Unable to load customer data.")), []);

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) => [customer.customerName, customer.organization, customer.email, customer.telephone, customer.source, ...customer.pocs.flatMap((poc) => [poc.name, poc.email, poc.mobile])].some((value) => value?.toLowerCase().includes(needle)));
  }, [customers, search]);

  const selectedCustomers = useMemo(() => customers.filter((customer) => customer.id && selectedIds.includes(customer.id)), [customers, selectedIds]);

  const saveCustomer = useMutation({
    mutationFn: async () => {
      if (!form.customerName.trim()) throw new Error("Customer name is required");
      const data = { ...form, customerName: form.customerName.trim(), pocs: form.pocs.filter((poc) => poc.name.trim() || poc.email.trim() || poc.mobile.trim()), created_by: appUser?.id };
      if (editingCustomer?.id) await customerDataAPI.update(editingCustomer.id, data);
      else await customerDataAPI.create(data);
    },
    onSuccess: () => { toast.success(editingCustomer ? "Customer updated" : "Customer added"); closeForm(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const addRemark = useMutation({
    mutationFn: async () => {
      if (!remarksCustomer?.id || !remarkText.trim()) throw new Error("Enter a remark first");
      const remark: CustomerRemark = { id: crypto.randomUUID(), text: remarkText.trim(), createdAt: new Date().toISOString(), createdBy: appUser?.fullName };
      await customerDataAPI.update(remarksCustomer.id, { remarks: [...(remarksCustomer.remarks || []), remark] });
    },
    onSuccess: () => { toast.success("Remark saved to history"); setRemarkText(""); setRemarksCustomer(null); },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCustomer = useMutation({ mutationFn: (id: string) => customerDataAPI.delete(id), onSuccess: () => { toast.success("Customer removed"); setPendingDelete(null); }, onError: () => toast.error("Unable to remove customer") });

  function closeForm() { setFormOpen(false); setEditingCustomer(null); setForm(emptyCustomer()); }
  function openEdit(customer: CustomerData) { setEditingCustomer(customer); setForm({ ...emptyCustomer(), ...customer, pocs: customer.pocs?.length ? customer.pocs : [emptyPoc()], remarks: customer.remarks || [] }); setFormOpen(true); }
  function updateField(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function updatePoc(id: string, field: keyof Omit<PointOfContact, "id">, value: string) { setForm((current) => ({ ...current, pocs: current.pocs.map((poc) => poc.id === id ? { ...poc, [field]: value } : poc) })); }
  function toggleCustomer(id: string, checked: boolean) { setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((entry) => entry !== id)); }
  function requestDelete(customer: CustomerData) { if (!isAdmin) { setShowPermissionDenied(true); return; } setPendingDelete(customer); }
  function composeEmail(email?: string) { if (!email) { toast.error("This customer has no email address."); return; } window.location.href = `mailto:${encodeURIComponent(email)}`; }
  function composeCampaign() {
    const emails = [...new Set(selectedCustomers.map((customer) => customer.email?.trim()).filter(Boolean))];
    if (!emails.length) { toast.error("Selected customers do not have email addresses."); return; }
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(campaignSubject)}&body=${encodeURIComponent(campaignMessage)}`;
    setCampaignOpen(false);
  }

  return <div className="min-h-full bg-slate-50/70 p-3 sm:p-5 lg:p-8"><div className="mx-auto max-w-[1600px] space-y-5 sm:space-y-7">
    <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 sm:pb-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Customer management</div><h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Customer Data</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Maintain customer details, points of contact, lead source, and follow-up remarks.</p></div><div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3"><Button variant="outline" className="border-blue-200 bg-blue-50 font-semibold text-blue-700 hover:bg-blue-100" onClick={() => selectedCustomers.length ? setCampaignOpen(true) : toast.error("Select one or more customers first.")}><Send className="mr-2 h-4 w-4" />Run campaign ({selectedCustomers.length})</Button><Button className="bg-slate-950 font-semibold shadow-md hover:bg-slate-800" onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />Add customer</Button></div></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"><Stat icon={<Building2 className="h-5 w-5" />} label="Total customers" value={customers.length} color="blue" /><Stat icon={<Users className="h-5 w-5" />} label="Points of contact" value={customers.reduce((total, customer) => total + (customer.pocs?.length || 0), 0)} color="violet" /><Stat icon={<MessageSquarePlus className="h-5 w-5" />} label="With remarks" value={customers.filter((customer) => customer.remarks?.length).length} color="emerald" /></div>
    <Card className="overflow-hidden"><CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Customer directory</CardTitle><p className="mt-1 text-sm text-slate-500">Select multiple customers to prepare a campaign email.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers or POCs" className="pl-9" /></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-12 px-4 py-3"><Checkbox checked={filteredCustomers.length > 0 && filteredCustomers.every((customer) => customer.id && selectedIds.includes(customer.id))} onCheckedChange={(checked) => setSelectedIds(checked ? filteredCustomers.map((customer) => customer.id!).filter(Boolean) : [])} aria-label="Select all customers" /></th><th className="px-4 py-3">Customer / organization</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">POCs</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredCustomers.map((customer) => <tr key={customer.id} className="hover:bg-slate-50/70"><td className="px-4 py-4"><Checkbox checked={!!customer.id && selectedIds.includes(customer.id)} onCheckedChange={(checked) => customer.id && toggleCustomer(customer.id, checked === true)} aria-label={`Select ${customer.customerName}`} /></td><td className="px-4 py-4"><p className="font-semibold text-slate-900">{customer.customerName}</p><p className="mt-1 text-xs text-slate-500">{customer.organization || "No organization"}</p></td><td className="px-4 py-4"><p>{customer.telephone || "—"}</p><p className="mt-1 text-xs text-slate-500">{customer.email || "No email"}</p></td><td className="px-4 py-4"><p className="font-medium text-slate-700">{customer.pocs?.[0]?.name || "No POC"}</p><p className="mt-1 text-xs text-slate-500">{customer.pocs?.length || 0} contact{customer.pocs?.length === 1 ? "" : "s"}</p></td><td className="px-4 py-4"><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{customer.source}</span>{customer.referenceName && <p className="mt-2 text-xs text-slate-500">{customer.referenceName}</p>}</td><td className="px-4 py-4"><Button variant="ghost" size="sm" onClick={() => setRemarksCustomer(customer)}><MessageSquarePlus className="mr-1.5 h-4 w-4" />{customer.remarks?.length || 0}</Button></td><td className="px-4 py-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Compose email" onClick={() => composeEmail(customer.email)}><Mail className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Edit customer" onClick={() => openEdit(customer)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50 hover:text-red-700" title="Delete customer" onClick={() => requestDelete(customer)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{!filteredCustomers.length && <tr><td colSpan={7} className="px-4 py-14 text-center text-slate-500">No customers found. Add your first customer to get started.</td></tr>}</tbody></table></div></CardContent></Card>
    <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{editingCustomer ? "Edit customer" : "Add customer"}</DialogTitle><DialogDescription>Save customer information and one or more points of contact.</DialogDescription></DialogHeader><form onSubmit={(event: FormEvent) => { event.preventDefault(); saveCustomer.mutate(); }} className="space-y-6"><section className="space-y-4"><h3 className="font-semibold text-slate-900">Customer information</h3><div className="grid gap-4 sm:grid-cols-2"><Field label="Customer name *" value={form.customerName} onChange={(value) => updateField("customerName", value)} /><Field label="Organization" value={form.organization || ""} onChange={(value) => updateField("organization", value)} /><Field label="Telephone" value={form.telephone || ""} onChange={(value) => updateField("telephone", value)} type="tel" /><Field label="Email" value={form.email || ""} onChange={(value) => updateField("email", value)} type="email" /><div className="sm:col-span-2"><Label>Address</Label><Textarea value={form.address || ""} onChange={(event) => updateField("address", event.target.value)} className="mt-2" /></div></div></section><section className="space-y-4 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-slate-900">Points of contact</h3><p className="text-sm text-slate-500">Add POC details for this customer.</p></div><Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, pocs: [...current.pocs, emptyPoc()] }))}><Plus className="mr-2 h-4 w-4" />Add POC</Button></div>{form.pocs.map((poc, index) => <div key={poc.id} className="rounded-lg bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">POC {index + 1}</p>{form.pocs.length > 1 && <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setForm((current) => ({ ...current, pocs: current.pocs.filter((entry) => entry.id !== poc.id) }))}>Remove</Button>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Name" value={poc.name} onChange={(value) => updatePoc(poc.id, "name", value)} /><Field label="Designation" value={poc.designation} onChange={(value) => updatePoc(poc.id, "designation", value)} /><Field label="Email" value={poc.email} onChange={(value) => updatePoc(poc.id, "email", value)} type="email" /><Field label="Mobile" value={poc.mobile} onChange={(value) => updatePoc(poc.id, "mobile", value)} type="tel" /></div></div>)}</section><section className="space-y-4"><div><h3 className="font-semibold text-slate-900">Lead source</h3><p className="text-sm text-slate-500">Choose how this customer entered the pipeline.</p></div><RadioGroup value={form.source} onValueChange={(value) => updateField("source", value)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">{sources.map((source) => <Label key={source} htmlFor={`source-${source}`} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium hover:bg-slate-50"><RadioGroupItem value={source} id={`source-${source}`} />{source}</Label>)}</RadioGroup>{form.source === "Reference" && <div className="max-w-md"><Field label="Referred by" value={form.referenceName || ""} onChange={(value) => updateField("referenceName", value)} /></div>}</section><DialogFooter><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={saveCustomer.isPending}>{saveCustomer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingCustomer ? "Save changes" : "Add customer"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={!!remarksCustomer} onOpenChange={(open) => !open && setRemarksCustomer(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Customer remarks</DialogTitle><DialogDescription>{remarksCustomer?.customerName}</DialogDescription></DialogHeader><div className="max-h-64 space-y-3 overflow-y-auto">{remarksCustomer?.remarks?.length ? [...remarksCustomer.remarks].reverse().map((remark) => <div key={remark.id} className="rounded-lg border p-3"><p>{remark.text}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(remark.createdAt).toLocaleString()}{remark.createdBy ? ` · ${remark.createdBy}` : ""}</p></div>) : <p className="py-6 text-center text-sm text-muted-foreground">No remarks yet.</p>}</div><div><Label>Add remark</Label><Textarea value={remarkText} onChange={(event) => setRemarkText(event.target.value)} placeholder="Document follow-up actions or important notes..." className="mt-2" /></div><DialogFooter><Button variant="outline" onClick={() => setRemarksCustomer(null)}>Close</Button><Button onClick={() => addRemark.mutate()} disabled={addRemark.isPending || !remarkText.trim()}>Save remark</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}><DialogContent><DialogHeader><DialogTitle>Run email campaign</DialogTitle><DialogDescription>Open your email app with {selectedCustomers.length} selected customer{selectedCustomers.length === 1 ? "" : "s"} in BCC.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="Subject" value={campaignSubject} onChange={setCampaignSubject} /><div><Label>Message</Label><Textarea value={campaignMessage} onChange={(event) => setCampaignMessage(event.target.value)} className="mt-2 min-h-32" placeholder="Write your campaign message..." /></div></div><DialogFooter><Button variant="outline" onClick={() => setCampaignOpen(false)}>Cancel</Button><Button onClick={composeCampaign}><Mail className="mr-2 h-4 w-4" />Open email</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}><DialogContent><DialogHeader><DialogTitle>Delete customer?</DialogTitle><DialogDescription>This permanently removes {pendingDelete?.customerName} and related contact details.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="destructive" onClick={() => pendingDelete?.id && deleteCustomer.mutate(pendingDelete.id)} disabled={deleteCustomer.isPending}>{deleteCustomer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</Button></DialogFooter></DialogContent></Dialog><PermissionDeniedDialog open={showPermissionDenied} onOpenChange={setShowPermissionDenied} message="Only administrators can delete customer records." />
  </div></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2" /></div>; }
function Stat({ icon, label, value, color }: { icon: ReactNode; label: string; value: number; color: "blue" | "violet" | "emerald" }) { const classes = { blue: "bg-blue-100 text-blue-600", violet: "bg-violet-100 text-violet-600", emerald: "bg-emerald-100 text-emerald-600" }; return <Card><CardContent className="flex min-h-[104px] items-center gap-4 p-5"><div className={`rounded-xl p-3 ${classes[color]}`}>{icon}</div><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div></CardContent></Card>; }
