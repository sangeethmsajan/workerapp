import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import type { Project } from "@shared/schema";
import { formatINR, statusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, MapPin, Calendar, Wallet, Trash2, Pencil } from "lucide-react";
import { NewProjectDialog } from "@/components/dialogs/NewProjectDialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Projects() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Project | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted" });
      setViewing(null);
    },
  });

  if (isLoading) {
    return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">{projects.length} total · {projects.filter(p => p.status === "active").length} active</p>
        </div>
        <Button onClick={() => setCreating(true)} data-testid="button-add-project">
          <Plus className="w-4 h-4 mr-1.5" /> New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="rounded-xl p-12 text-center bg-card border-card-border">
          <p className="text-sm text-muted-foreground mb-4">No projects yet.</p>
          <Button onClick={() => setCreating(true)} data-testid="button-empty-add">Create first project</Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const sc = statusColor(p.status === "active" ? "in-progress" : p.status === "completed" ? "done" : "delayed");
            return (
              <Card
                key={p.id}
                className="rounded-xl p-5 bg-card border-card-border cursor-pointer hover-elevate"
                onClick={() => setViewing(p)}
                data-testid={`card-project-${p.id}`}
              >
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="font-medium">{p.name}</div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", sc.pill)}>{p.status}</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1"><MapPin className="w-3 h-3" /> {p.location}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1"><Wallet className="w-3 h-3" /> Budget {formatINR(p.budget)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-4">
                  <Calendar className="w-3 h-3" /> {format(new Date(p.startDate), "d MMM")} → {format(new Date(p.endDate), "d MMM yyyy")}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs text-muted-foreground">Progress</div>
                    <div className="text-xs font-medium">{p.progress}%</div>
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NewProjectDialog open={creating} onOpenChange={setCreating} />
      {editing && <NewProjectDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} edit={editing} />}

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent>
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.name}</DialogTitle>
                <DialogDescription>{viewing.location}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-xs text-muted-foreground">Budget</div><div>{formatINR(viewing.budget)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Status</div><div className="capitalize">{viewing.status}</div></div>
                  <div><div className="text-xs text-muted-foreground">Start</div><div>{format(new Date(viewing.startDate), "d MMM yyyy")}</div></div>
                  <div><div className="text-xs text-muted-foreground">End</div><div>{format(new Date(viewing.endDate), "d MMM yyyy")}</div></div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Progress {viewing.progress}%</div>
                  <Progress value={viewing.progress} className="h-2" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="destructive" onClick={() => del.mutate(viewing.id)} data-testid="button-delete-project">
                  <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                </Button>
                <Button variant="outline" onClick={() => { setEditing(viewing); setViewing(null); }} data-testid="button-edit-project">
                  <Pencil className="w-4 h-4 mr-1.5" /> Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
