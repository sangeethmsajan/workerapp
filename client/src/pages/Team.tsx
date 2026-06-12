import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Worker } from "@shared/schema";
import { formatINR } from "@/lib/format";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["Mason", "Electrician", "Plumber", "Carpenter", "Painter", "Welder", "Helper", "Supervisor"];
const SITES = ["Site A", "Site B", "Site C", "Downtown"];
const PALETTE = ["#8b5cf6", "#10b981", "#f97316", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6", "#ef4444"];

export default function TeamPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: workers = [], isLoading } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/workers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workers"] });
      toast({ title: "Worker removed" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team &amp; workers</h2>
          <p className="text-sm text-muted-foreground">{workers.length} workers across all sites</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-worker">
          <Plus className="w-4 h-4 mr-1.5" /> Add worker
        </Button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      ) : workers.length === 0 ? (
        <Card className="rounded-xl p-12 text-center bg-card border-card-border">
          <p className="text-sm text-muted-foreground mb-4">No workers yet.</p>
          <Button onClick={() => setOpen(true)}>Add worker</Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((w) => (
            <Card key={w.id} className="rounded-xl p-5 bg-card border-card-border" data-testid={`card-worker-${w.id}`}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-medium"
                  style={{ backgroundColor: `${w.color}30`, color: w.color }}
                >
                  {w.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{w.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{w.role} · {w.site}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Daily wage</div>
                  <div className="font-medium">{formatINR(w.dailyWage)}</div>
                </div>
                <div className="flex gap-1">
                  <Link href="/attendance">
                    <Button size="sm" variant="outline" data-testid={`link-attendance-${w.id}`}>Attendance</Button>
                  </Link>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(w); setOpen(true); }} data-testid={`button-edit-worker-${w.id}`}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(w.id)} data-testid={`button-delete-worker-${w.id}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <WorkerDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} edit={editing} />
    </div>
  );
}

function WorkerDialog({ open, onOpenChange, edit }: { open: boolean; onOpenChange: (v: boolean) => void; edit: Worker | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [site, setSite] = useState(SITES[0]);
  const [wage, setWage] = useState(800);
  const [color, setColor] = useState(PALETTE[0]);

  useEffect(() => {
    if (edit) {
      setName(edit.name); setRole(edit.role); setSite(edit.site); setWage(edit.dailyWage); setColor(edit.color);
    } else if (open) {
      setName(""); setRole(ROLES[0]); setSite(SITES[0]); setWage(800); setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    }
  }, [edit, open]);

  const mut = useMutation({
    mutationFn: async () => {
      const parts = name.trim().split(/\s+/);
      const avatar = ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
      const body = { name, role, site, dailyWage: Number(wage), avatar, color };
      const res = edit ? await apiRequest("PATCH", `/api/workers/${edit.id}`, body) : await apiRequest("POST", "/api/workers", body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workers"] });
      toast({ title: edit ? "Worker updated" : "Worker added" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{edit ? "Edit worker" : "Add worker"}</DialogTitle>
          <DialogDescription>Maintain a record of every team member on site.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-worker-name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger data-testid="select-worker-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Site</Label>
              <Select value={site} onValueChange={setSite}>
                <SelectTrigger data-testid="select-worker-site"><SelectValue /></SelectTrigger>
                <SelectContent>{SITES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Daily wage (₹)</Label><Input type="number" value={wage} onChange={(e) => setWage(Number(e.target.value))} data-testid="input-worker-wage" /></div>
          <div>
            <Label>Avatar color</Label>
            <div className="flex gap-2 mt-1">
              {PALETTE.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 ${c === color ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} data-testid={`color-${c}`} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!name || mut.isPending} data-testid="button-save-worker">{mut.isPending ? "Saving..." : (edit ? "Save" : "Add")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
