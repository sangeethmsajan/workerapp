import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Expense, Project } from "@shared/schema";
import { categoryColor, formatINRFull, statusColor, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Boxes, Hammer, Package, Truck, Users as UsersIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";

const CATEGORIES = ["Equipment", "Materials", "Transport", "Labour", "Other"];
const STATUSES = ["pending", "approved", "paid"];

function catIcon(c: string) {
  switch (c) {
    case "Equipment": return <Hammer className="w-4 h-4" />;
    case "Materials": return <Package className="w-4 h-4" />;
    case "Transport": return <Truck className="w-4 h-4" />;
    case "Labour": return <UsersIcon className="w-4 h-4" />;
    default: return <Boxes className="w-4 h-4" />;
  }
}

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const filtered = useMemo(() => expenses.filter((e) => {
    if (catFilter !== "all" && e.category !== catFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (projectFilter !== "all" && String(e.projectId) !== projectFilter) return false;
    return true;
  }), [expenses, catFilter, statusFilter, projectFilter]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const advance = useMutation({
    mutationFn: async (e: Expense) => {
      const next = e.status === "pending" ? "approved" : e.status === "approved" ? "paid" : "pending";
      return apiRequest("PATCH", `/api/expenses/${e.id}`, { status: next });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/expenses"] }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense deleted" });
    },
  });

  function siteName(pid: number | null) {
    if (pid == null) return "All sites";
    return projects.find((p) => p.id === pid)?.location || "All sites";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Expenses</h2>
          <p className="text-sm text-muted-foreground">Total: <span className="font-medium text-foreground" data-testid="text-total-expenses">{formatINRFull(total)}</span></p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-expense">
          <Plus className="w-4 h-4 mr-1.5" /> Add expense
        </Button>
      </div>

      <Card className="rounded-xl p-4 bg-card border-card-border">
        <div className="flex flex-wrap gap-3">
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40" data-testid="filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="filter-expense-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-44" data-testid="filter-expense-project"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? <Skeleton className="h-96 rounded-xl" /> :
        filtered.length === 0 ? (
          <Card className="rounded-xl p-12 text-center bg-card border-card-border">
            <p className="text-sm text-muted-foreground mb-4">No expenses match filters.</p>
            <Button onClick={() => setOpen(true)}>Add expense</Button>
          </Card>
        ) : (
        <Card className="rounded-xl bg-card border-card-border overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((e) => {
              const cc = categoryColor(e.category);
              const sc = statusColor(e.status);
              return (
                <div key={e.id} className="px-5 py-3 flex items-center gap-3 group" data-testid={`row-expense-${e.id}`}>
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", cc.bg, cc.text)}>{catIcon(e.category)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{e.category} · {siteName(e.projectId)} · {format(new Date(e.date), "d MMM")}</div>
                  </div>
                  <div className="text-sm font-medium shrink-0">{formatINRFull(e.amount)}</div>
                  <button
                    onClick={() => advance.mutate(e)}
                    className={cn("text-xs px-2.5 py-1 rounded-full border capitalize", sc.pill)}
                    data-testid={`button-advance-expense-${e.id}`}
                  >{e.status}</button>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }} data-testid={`button-edit-expense-${e.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)} data-testid={`button-delete-expense-${e.id}`}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ExpenseDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} edit={editing} projects={projects} />
    </div>
  );
}

function ExpenseDialog({ open, onOpenChange, edit, projects }: { open: boolean; onOpenChange: (v: boolean) => void; edit: Expense | null; projects: Project[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [projectId, setProjectId] = useState("none");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (edit) {
      setTitle(edit.title); setCategory(edit.category); setProjectId(edit.projectId ? String(edit.projectId) : "none");
      setAmount(edit.amount); setDate(edit.date); setStatus(edit.status); setNotes(edit.notes || "");
    } else if (open) {
      setTitle(""); setCategory(CATEGORIES[0]); setProjectId("none"); setAmount(0); setDate(todayISO()); setStatus("pending"); setNotes("");
    }
  }, [edit, open]);

  const mut = useMutation({
    mutationFn: async () => {
      const body = {
        title, category, projectId: projectId !== "none" ? Number(projectId) : null,
        amount: Number(amount), date, status, notes: notes || null,
      };
      const res = edit ? await apiRequest("PATCH", `/api/expenses/${edit.id}`, body) : await apiRequest("POST", "/api/expenses", body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: edit ? "Expense updated" : "Expense added" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{edit ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>Track costs against your projects.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-expense-title" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-expense-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger data-testid="select-expense-project"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} data-testid="input-expense-amount" /></div>
            <div className="flex flex-col gap-1.5"><Label>Date</Label><DatePicker value={date} onChange={setDate} /></div>
          </div>
          <div><Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-expense-status"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-expense-notes" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!title || !amount || mut.isPending} data-testid="button-save-expense">{mut.isPending ? "Saving..." : (edit ? "Save" : "Add")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
