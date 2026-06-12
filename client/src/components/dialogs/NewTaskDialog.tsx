import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useState } from "react";
import { todayISO } from "@/lib/format";
import type { Project, Worker, Task } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: Task;
  defaultDate?: string;
}

export function NewTaskDialog({ open, onOpenChange, edit, defaultDate }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: projects } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: workers } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [date, setDate] = useState(defaultDate || todayISO());
  const [status, setStatus] = useState<"pending" | "in-progress" | "done" | "delayed">("pending");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (edit) {
      setTitle(edit.title);
      setProjectId(edit.projectId ? String(edit.projectId) : "");
      setAssigneeId(edit.assigneeId ? String(edit.assigneeId) : "none");
      setDate(edit.date);
      setStatus(edit.status as any);
      setNotes(edit.notes || "");
    } else if (open) {
      setTitle(""); setProjectId(""); setAssigneeId("none");
      setDate(defaultDate || todayISO()); setStatus("pending"); setNotes("");
    }
  }, [edit, open, defaultDate]);

  const mut = useMutation({
    mutationFn: async () => {
      const body = {
        title,
        projectId: projectId ? Number(projectId) : null,
        assigneeId: assigneeId !== "none" ? Number(assigneeId) : null,
        date,
        status,
        notes: notes || null,
      };
      const res = edit
        ? await apiRequest("PATCH", `/api/tasks/${edit.id}`, body)
        : await apiRequest("POST", "/api/tasks", body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: edit ? "Task updated" : "Task created" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-task">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>Schedule work for a specific date and assign it to a worker.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-task-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger data-testid="select-task-project"><SelectValue placeholder="Pick project" /></SelectTrigger>
                <SelectContent>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger data-testid="select-task-assignee"><SelectValue placeholder="Pick worker" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {workers?.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger data-testid="select-task-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-task-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-task">Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !title} data-testid="button-save-task">
            {mut.isPending ? "Saving..." : (edit ? "Save" : "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
