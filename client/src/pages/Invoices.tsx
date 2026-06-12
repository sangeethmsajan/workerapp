import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Invoice, Project, Settings } from "@shared/schema";
import { formatINRFull, isoOffset, statusColor, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil, Printer } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";

interface LineItem { description: string; qty: number; rate: number; }

const STATUSES = ["draft", "sent", "paid", "overdue"];

export default function InvoicesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted" });
      setViewing(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => apiRequest("PATCH", `/api/invoices/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }),
  });

  function projectName(pid: number | null) {
    if (pid == null) return "—";
    return projects.find((p) => p.id === pid)?.name || "—";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Invoices</h2>
          <p className="text-sm text-muted-foreground">{invoices.length} invoices</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-invoice">
          <Plus className="w-4 h-4 mr-1.5" /> New invoice
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-96 rounded-xl" /> :
        invoices.length === 0 ? (
          <Card className="rounded-xl p-12 text-center bg-card border-card-border">
            <p className="text-sm text-muted-foreground mb-4">No invoices yet.</p>
            <Button onClick={() => setOpen(true)}>Create first invoice</Button>
          </Card>
        ) : (
        <Card className="rounded-xl bg-card border-card-border overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <div className="col-span-4">Client</div>
            <div className="col-span-3">Project</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Due</div>
            <div className="col-span-1 text-right">Status</div>
          </div>
          <div className="divide-y divide-border">
            {invoices.map((inv) => {
              const sc = statusColor(inv.status);
              return (
                <div
                  key={inv.id}
                  className="grid grid-cols-12 px-5 py-3 items-center text-sm cursor-pointer hover-elevate"
                  onClick={() => setViewing(inv)}
                  data-testid={`row-invoice-${inv.id}`}
                >
                  <div className="col-span-4 font-medium truncate">{inv.clientName}</div>
                  <div className="col-span-3 text-muted-foreground truncate">{projectName(inv.projectId)}</div>
                  <div className="col-span-2 font-medium">{formatINRFull(inv.amount)}</div>
                  <div className="col-span-2 text-muted-foreground">{format(new Date(inv.dueDate), "d MMM yyyy")}</div>
                  <div className="col-span-1 text-right">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border capitalize", sc.pill)}>{inv.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <InvoiceDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} edit={editing} projects={projects} />

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          {viewing && (() => {
            let items: LineItem[] = [];
            try { items = JSON.parse(viewing.lineItems); } catch {}
            const total = items.reduce((s, i) => s + (i.qty * i.rate), 0) || viewing.amount;
            const sc = statusColor(viewing.status);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Invoice #{viewing.id}</DialogTitle>
                  <DialogDescription>{settings?.companyName} → {viewing.clientName}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><div className="text-xs text-muted-foreground">Date</div><div>{format(new Date(viewing.date), "d MMM yyyy")}</div></div>
                    <div><div className="text-xs text-muted-foreground">Due date</div><div>{format(new Date(viewing.dueDate), "d MMM yyyy")}</div></div>
                    <div><div className="text-xs text-muted-foreground">Project</div><div>{projectName(viewing.projectId)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Status</div><div><span className={cn("text-xs px-2 py-0.5 rounded-full border capitalize", sc.pill)}>{viewing.status}</span></div></div>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 px-4 py-2 text-xs text-muted-foreground bg-background/40 border-b border-border">
                      <div className="col-span-7">Description</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-3 text-right">Rate</div>
                    </div>
                    {items.map((i, idx) => (
                      <div key={idx} className="grid grid-cols-12 px-4 py-2 text-sm border-b border-border last:border-0">
                        <div className="col-span-7">{i.description}</div>
                        <div className="col-span-2 text-right">{i.qty}</div>
                        <div className="col-span-3 text-right">{formatINRFull(i.rate)}</div>
                      </div>
                    ))}
                    <div className="grid grid-cols-12 px-4 py-3 text-sm font-medium bg-background/40 border-t border-border">
                      <div className="col-span-9 text-right">Total</div>
                      <div className="col-span-3 text-right">{formatINRFull(total)}</div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2 flex-wrap">
                  <Button variant="destructive" onClick={() => del.mutate(viewing.id)} data-testid="button-delete-invoice">
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                  </Button>
                  <Button variant="outline" onClick={() => { setEditing(viewing); setOpen(true); setViewing(null); }} data-testid="button-edit-invoice">
                    <Pencil className="w-4 h-4 mr-1.5" /> Edit
                  </Button>
                  {viewing.status === "draft" && (
                    <Button variant="outline" onClick={() => updateStatus.mutate({ id: viewing.id, status: "sent" })} data-testid="button-send-invoice">
                      Mark as sent
                    </Button>
                  )}
                  {viewing.status !== "paid" && (
                    <Button onClick={() => updateStatus.mutate({ id: viewing.id, status: "paid" })} data-testid="button-paid-invoice">
                      Mark as paid
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => window.print()} data-testid="button-print-invoice">
                    <Printer className="w-4 h-4 mr-1.5" /> Print
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceDialog({ open, onOpenChange, edit, projects }: { open: boolean; onOpenChange: (v: boolean) => void; edit: Invoice | null; projects: Project[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [clientName, setClientName] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(isoOffset(14));
  const [status, setStatus] = useState("draft");
  const [items, setItems] = useState<LineItem[]>([{ description: "", qty: 1, rate: 0 }]);

  useEffect(() => {
    if (edit) {
      setClientName(edit.clientName);
      setProjectId(edit.projectId ? String(edit.projectId) : "none");
      setDate(edit.date); setDueDate(edit.dueDate); setStatus(edit.status);
      try { setItems(JSON.parse(edit.lineItems) as LineItem[]); } catch { setItems([{ description: "", qty: 1, rate: 0 }]); }
    } else if (open) {
      setClientName(""); setProjectId("none"); setDate(todayISO()); setDueDate(isoOffset(14)); setStatus("draft");
      setItems([{ description: "", qty: 1, rate: 0 }]);
    }
  }, [edit, open]);

  const total = useMemo(() => items.reduce((s, i) => s + (Number(i.qty) * Number(i.rate)), 0), [items]);

  const mut = useMutation({
    mutationFn: async () => {
      const body = {
        clientName,
        projectId: projectId !== "none" ? Number(projectId) : null,
        amount: total,
        date, dueDate, status,
        lineItems: JSON.stringify(items),
      };
      const res = edit ? await apiRequest("PATCH", `/api/invoices/${edit.id}`, body) : await apiRequest("POST", "/api/invoices", body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: edit ? "Invoice updated" : "Invoice created" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function updateItem(idx: number, field: keyof LineItem, value: any) {
    setItems((arr) => arr.map((it, i) => i === idx ? { ...it, [field]: field === "description" ? value : Number(value) } : it));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit invoice" : "New invoice"}</DialogTitle>
          <DialogDescription>Bill a client for completed work.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div><Label>Client name</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} data-testid="input-invoice-client" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger data-testid="select-invoice-project"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-invoice-status"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label>Date</Label><DatePicker value={date} onChange={setDate} /></div>
            <div className="flex flex-col gap-1.5"><Label>Due date</Label><DatePicker value={dueDate} onChange={setDueDate} /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Line items</Label>
              <Button size="sm" variant="outline" onClick={() => setItems((a) => [...a, { description: "", qty: 1, rate: 0 }])} data-testid="button-add-line">
                <Plus className="w-3 h-3 mr-1" /> Add row
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-6" placeholder="Description" value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} data-testid={`input-line-desc-${idx}`} />
                  <Input className="col-span-2" type="number" placeholder="Qty" value={it.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} data-testid={`input-line-qty-${idx}`} />
                  <Input className="col-span-3" type="number" placeholder="Rate" value={it.rate} onChange={(e) => updateItem(idx, "rate", e.target.value)} data-testid={`input-line-rate-${idx}`} />
                  <Button size="icon" variant="ghost" className="col-span-1" onClick={() => setItems((a) => a.filter((_, i) => i !== idx))} data-testid={`button-remove-line-${idx}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 text-sm flex justify-end gap-2">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium" data-testid="text-invoice-total">{formatINRFull(total)}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!clientName || mut.isPending} data-testid="button-save-invoice">{mut.isPending ? "Saving..." : (edit ? "Save" : "Create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
