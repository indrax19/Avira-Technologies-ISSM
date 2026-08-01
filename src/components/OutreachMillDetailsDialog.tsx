import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OutreachMill } from "@/integrations/firebase/outreachMillsAPI";

type DetailRow = [string, string | undefined];

function DetailTable({ title, rows }: { title: string; rows: DetailRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200">
      <div className="border-b bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th className="w-40 bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>
              <td className="whitespace-pre-wrap bg-white px-4 py-3 text-slate-900">{value || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function getMillStatus(mill: OutreachMill) {
  return mill.transferredAt ? "Transferred" : mill.status === "Active" || mill.status === "Pending" || !mill.status ? "Outreach" : mill.status === "Close" ? "Closed" : mill.status;
}

export default function OutreachMillDetailsDialog({ mill, onClose }: { mill: OutreachMill | null; onClose: () => void }) {
  return (
    <Dialog open={!!mill} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{mill?.spinningMill || "Mill details"}</DialogTitle>
          <DialogDescription>Complete outreach record and follow-up information.</DialogDescription>
        </DialogHeader>
        {mill && (
          <div className="space-y-5">
            <DetailTable title="Mill information" rows={[["Spinning Mill", mill.spinningMill], ["Unit", mill.unit], ["City", mill.city], ["Address", mill.address]]} />
            <DetailTable title="Contact information" rows={[["Phone", mill.phone], ["Email", mill.email]]} />
            <DetailTable title="Point of contact" rows={[["Name", mill.pocName], ["Number", mill.pocNumber], ["Email", mill.pocEmail]]} />
            <DetailTable title="Assignment and status" rows={[["Assigned to", mill.assignedTo], ["Status", getMillStatus(mill)], ["Last updated", mill.updated_at ? new Date(mill.updated_at).toLocaleString() : "—"]]} />
            <DetailTable title="Notes" rows={[["Notes", mill.notes]]} />
            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-semibold text-slate-900">Follow-up remarks</h3></div>
              {mill.remarks?.length ? <div className="divide-y divide-slate-100">{[...mill.remarks].reverse().map((remark) => <div key={remark.id} className="px-4 py-3"><p className="text-sm text-slate-900">{remark.text}</p><p className="mt-1 text-xs text-slate-500">{new Date(remark.createdAt).toLocaleString()}{remark.createdBy ? ` · ${remark.createdBy}` : ""}</p></div>)}</div> : <p className="px-4 py-5 text-sm text-slate-500">No remarks recorded.</p>}
            </section>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
