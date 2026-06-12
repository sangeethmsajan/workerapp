import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Attendance, Worker, Project } from "@shared/schema";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Search, X, FolderOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AttStatus = "present" | "absent" | "leave";

export default function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const { data: workers = [], isLoading: lw } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: attendance = [], isLoading: la } = useQuery<Attendance[]>({ queryKey: ["/api/attendance"] });
  const { data: projects = [], isLoading: lp } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const ITEMS_PER_PAGE = 5;

  // Build list of unique sites from workers to power the dropdown
  const workerSites = useMemo(() => {
    const sites = new Set(workers.map((w) => w.site).filter(Boolean));
    return Array.from(sites).sort();
  }, [workers]);

  // Match projects to worker sites — project name equals worker site
  const projectOptions = useMemo(() => {
    return projects.filter((p) => workerSites.includes(p.name));
  }, [projects, workerSites]);

  // Also include sites that don't have a matching project (shown as a site option)
  const unmatchedSites = useMemo(() => {
    const projectNames = new Set(projects.map((p) => p.name));
    return workerSites.filter((s) => !projectNames.has(s));
  }, [projects, workerSites]);

  const filteredWorkers = useMemo(() => {
    let list = workers;

    // Apply project/site filter
    if (selectedProject !== "all") {
      list = list.filter((w) => w.site === selectedProject);
    }

    // Apply text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          (w.role || "").toLowerCase().includes(query) ||
          (w.site || "").toLowerCase().includes(query)
      );
    }

    return list;
  }, [workers, searchQuery, selectedProject]);

  const totalPages = Math.ceil(filteredWorkers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedWorkers = useMemo(() => filteredWorkers.slice(startIndex, startIndex + ITEMS_PER_PAGE), [filteredWorkers, currentPage, startIndex]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedProject]);

  useEffect(() => {
    const maxPage = Math.max(1, totalPages);
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [totalPages, currentPage]);

  const dayRecords = useMemo(() => attendance.filter((a) => a.date === date), [attendance, date]);
  const byWorker = useMemo(() => {
    const m = new Map<number, Attendance>();
    dayRecords.forEach((r) => m.set(r.workerId, r));
    return m;
  }, [dayRecords]);

  const selectedMonthPrefix = useMemo(() => date.slice(0, 7), [date]); // "YYYY-MM"
  const presentDaysByWorker = useMemo(() => {
    const counts = new Map<number, number>();
    attendance.forEach((a) => {
      if (a.date.startsWith(selectedMonthPrefix) && a.status === "present") {
        const cur = counts.get(a.workerId) || 0;
        counts.set(a.workerId, cur + 1);
      }
    });
    return counts;
  }, [attendance, selectedMonthPrefix]);

  // Summary counters respect the active project/search filter
  const filteredWorkerIds = useMemo(() => new Set(filteredWorkers.map((w) => w.id)), [filteredWorkers]);
  const present = dayRecords.filter((r) => r.status === "present" && filteredWorkerIds.has(r.workerId)).length;
  const absent = dayRecords.filter((r) => r.status === "absent" && filteredWorkerIds.has(r.workerId)).length;
  const leave = dayRecords.filter((r) => r.status === "leave" && filteredWorkerIds.has(r.workerId)).length;

  const mark = useMutation({
    mutationFn: async ({ workerId, status, existing }: { workerId: number; status: AttStatus; existing?: Attendance }) => {
      if (existing) {
        return apiRequest("PATCH", `/api/attendance/${existing.id}`, { status });
      }
      return apiRequest("POST", "/api/attendance", { workerId, date, status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendance"] }),
  });

  const isLoading = lw || la || lp;

  const isFiltered = selectedProject !== "all" || searchQuery.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Attendance</h2>
          <p className="text-sm text-muted-foreground">Tap a status to mark each worker</p>
        </div>
        <DatePicker value={date} onChange={setDate} className="w-44" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-xl p-4 bg-card border-card-border" data-testid="counter-present">
          <div className="text-xs text-muted-foreground">Present</div>
          <div className="text-2xl font-semibold text-emerald-400">{present}</div>
        </Card>
        <Card className="rounded-xl p-4 bg-card border-card-border" data-testid="counter-absent">
          <div className="text-xs text-muted-foreground">Absent</div>
          <div className="text-2xl font-semibold text-rose-400">{absent}</div>
        </Card>
        <Card className="rounded-xl p-4 bg-card border-card-border" data-testid="counter-leave">
          <div className="text-xs text-muted-foreground">On leave</div>
          <div className="text-2xl font-semibold text-sky-400">{leave}</div>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Card className="rounded-xl bg-card border-card-border overflow-hidden">
          {/* Toolbar: search + project filter */}
          <div className="p-4 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search workers by name, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50 border-border"
                data-testid="input-attendance-search"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Project / Site filter dropdown */}
            <div className="sm:w-52 shrink-0">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger
                  className={cn(
                    "bg-background/50 border-border h-9 text-sm",
                    selectedProject !== "all" && "border-primary/50 text-primary"
                  )}
                  data-testid="trigger-project-filter"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="All Projects" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects / Sites</SelectItem>
                  {/* Projects that match worker sites */}
                  {projectOptions.map((p) => (
                    <SelectItem key={`project-${p.id}`} value={p.name} data-testid={`option-project-${p.id}`}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-block w-2 h-2 rounded-full shrink-0",
                            p.status === "active" ? "bg-emerald-400" : p.status === "completed" ? "bg-sky-400" : "bg-zinc-400"
                          )}
                        />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                  {/* Unmatched sites (no project) */}
                  {unmatchedSites.map((site) => (
                    <SelectItem key={`site-${site}`} value={site} data-testid={`option-site-${site}`}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
                        {site}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear all filters button */}
            {isFiltered && (
              <button
                onClick={() => { setSearchQuery(""); setSelectedProject("all"); }}
                className="shrink-0 text-xs flex items-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors cursor-pointer"
                data-testid="button-clear-all-filters"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}
          </div>

          {/* Active filter summary bar */}
          {isFiltered && (
            <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Showing</span>
              <span className="text-xs font-semibold text-foreground">{filteredWorkers.length}</span>
              <span className="text-xs text-muted-foreground">of {workers.length} workers</span>
              {selectedProject !== "all" && (
                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                  <FolderOpen className="h-3 w-3" />
                  {selectedProject}
                  <button onClick={() => setSelectedProject("all")} className="ml-0.5 hover:text-primary/80 cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 text-xs bg-accent text-accent-foreground border border-border rounded-full px-2 py-0.5">
                  <Search className="h-3 w-3" />
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery("")} className="ml-0.5 hover:opacity-70 cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}

          {filteredWorkers.length === 0 ? (
            <div className="px-5 py-12 text-center" data-testid="no-workers-found">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No workers found</p>
              <p className="text-xs text-muted-foreground">
                {selectedProject !== "all"
                  ? `No workers are assigned to "${selectedProject}"`
                  : `No workers match "${searchQuery}"`}
              </p>
              <button
                onClick={() => { setSearchQuery(""); setSelectedProject("all"); }}
                className="mt-3 text-xs text-primary hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {paginatedWorkers.map((w) => {
                const rec = byWorker.get(w.id);
                const current: AttStatus | null = (rec?.status as AttStatus) ?? null;
                const presentCount = presentDaysByWorker.get(w.id) || 0;
                return (
                  <div key={w.id} className="px-5 py-3 flex items-center gap-3" data-testid={`row-attendance-${w.id}`}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ backgroundColor: `${w.color}30`, color: w.color }}>{w.avatar}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{w.name}</span>
                        <span
                          className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-semibold shrink-0 transition-colors",
                            presentCount > 0
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                              : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                          )}
                          title={`${presentCount} days present this month`}
                          data-testid={`present-count-${w.id}`}
                        >
                          {presentCount}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{w.role} · {w.site}</div>
                    </div>
                    <div className="flex gap-1">
                      {(["present", "absent", "leave"] as AttStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => mark.mutate({ workerId: w.id, status: s, existing: rec })}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-md border transition-colors capitalize",
                            current === s
                              ? s === "present" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : s === "absent" ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                              : "border-border text-muted-foreground hover-elevate",
                          )}
                          data-testid={`button-${s}-${w.id}`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-4 bg-background/20" data-testid="pagination-controls">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                data-testid="button-prev-page"
              >
                Previous
              </button>
              <div className="text-xs text-muted-foreground font-medium" data-testid="text-page-info">
                Page {currentPage} of {totalPages}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                data-testid="button-next-page"
              >
                Next
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
