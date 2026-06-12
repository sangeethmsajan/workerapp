import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useState } from "react";
import { todayISO, isoOffset } from "@/lib/format";
import type { Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: Project;
}

export function NewProjectDialog({ open, onOpenChange, edit }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState(0);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(isoOffset(90));
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"active" | "on-hold" | "completed">("active");

  useEffect(() => {
    if (edit) {
      setName(edit.name); setLocation(edit.location); setBudget(edit.budget);
      setStartDate(edit.startDate); setEndDate(edit.endDate); setProgress(edit.progress);
      setStatus(edit.status as any);
    } else if (open) {
      setName(""); setLocation(""); setBudget(0);
      setStartDate(todayISO()); setEndDate(isoOffset(90));
      setProgress(0); setStatus("active");
    }
  }, [edit, open]);

  const mut = useMutation({
    mutationFn: async () => {
      const body = { name, location, budget: Number(budget), startDate, endDate, progress: Number(progress), status };
      const res = edit
        ? await apiRequest("PATCH", `/api/projects/${edit.id}`, body)
        : await apiRequest("POST", "/api/projects", body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: edit ? "Project updated" : "Project created" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-project">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>Track a new construction project across sites.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-project-name" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} data-testid="input-project-location" />
          </div>
          <div>
            <Label>Budget (₹)</Label>
            <Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} data-testid="input-project-budget" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Start date</Label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>End date</Label>
              <DatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Progress %</Label>
              <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} data-testid="input-project-progress" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger data-testid="select-project-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on-hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-project">Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !name || !location} data-testid="button-save-project">
            {mut.isPending ? "Saving..." : (edit ? "Save" : "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
