import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Project, Task, Worker } from "@shared/schema";
import { statusColor, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { NewTaskDialog } from "@/components/dialogs/NewTaskDialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";

const STATUS_CYCLE: Task["status"][] = ["pending", "in-progress", "done", "delayed"];

export default function TasksPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [date, setDate] = useState(todayISO());
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  const filtered = useMemo(() => tasks.filter((t) => {
    if (t.date !== date) return false;
    if (projectFilter !== "all" && String(t.projectId) !== projectFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (assigneeFilter !== "all" && String(t.assigneeId) !== assigneeFilter) return false;
    return true;
  }), [tasks, date, projectFilter, statusFilter, assigneeFilter]);

  const cycle = useMutation({
    mutationFn: async (t: Task) => {
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(t.status as Task["status"]) + 1) % STATUS_CYCLE.length];
      return apiRequest("PATCH", `/api/tasks/${t.id}`, { status: next });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task deleted" });
    },
  });

  function projectName(id: number | null) {
    return projects.find((p) => p.id === id)?.name || "—";
  }
  function workerName(id: number | null) {
    return workers.find((w) => w.id === id)?.name || "Unassigned";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Daily tasks</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} tasks for selected date</p>
        </div>
        <Button onClick={() => setCreating(true)} data-testid="button-add-task">
          <Plus className="w-4 h-4 mr-1.5" /> New task
        </Button>
      </div>

      <Card className="rounded-xl p-4 bg-card border-card-border">
        <div className="flex flex-wrap items-center gap-3">
          <DatePicker value={date} onChange={setDate} className="w-44" />
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-44" data-testid="filter-project"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {STATUS_CYCLE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-44" data-testid="filter-assignee"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {workers.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : filtered.length === 0 ? (
        <Card className="rounded-xl p-12 text-center bg-card border-card-border">
          <p className="text-sm text-muted-foreground mb-4">No tasks match the filters.</p>
          <Button onClick={() => setCreating(true)}>Create task</Button>
        </Card>
      ) : (
        <Card className="rounded-xl bg-card border-card-border overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((t) => {
              const sc = statusColor(t.status);
              return (
                <div
                  key={t.id}
                  className="px-5 py-3 flex items-center gap-3 group"
                  data-testid={`row-task-${t.id}`}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", sc.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{projectName(t.projectId)} · {workerName(t.assigneeId)}</div>
                  </div>
                  <button
                    onClick={() => cycle.mutate(t)}
                    className={cn("text-xs px-2.5 py-1 rounded-full border", sc.pill)}
                    data-testid={`button-cycle-status-${t.id}`}
                  >
                    {t.status === "in-progress" ? "In progress" : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                  </button>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(t)} data-testid={`button-edit-task-${t.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)} data-testid={`button-delete-task-${t.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <NewTaskDialog open={creating} onOpenChange={setCreating} defaultDate={date} />
      {editing && <NewTaskDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} edit={editing} />}
    </div>
  );
}
