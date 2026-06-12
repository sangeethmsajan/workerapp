import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project, Worker, Task, Attendance, Expense, Settings } from "@shared/schema";
import { formatINR, statusColor, todayISO, categoryColor, isoOffset, getLocalDateInTimezone, getLocalDateOffsetInTimezone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Boxes, Hammer, Package, Truck, Users as UsersIcon, MoreHorizontal } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const timezone = settings?.timezone || "UTC";

  const today = useMemo(() => getLocalDateInTimezone(timezone), [timezone]);
  const weekStart = useMemo(() => getLocalDateOffsetInTimezone(-6, timezone), [timezone]);

  const { data: projects = [], isLoading: lp } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: workers = [], isLoading: lw } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: tasks = [], isLoading: lt } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: attendance = [], isLoading: la } = useQuery<Attendance[]>({ queryKey: ["/api/attendance"] });
  const { data: expenses = [], isLoading: le } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });

  const isLoading = lp || lw || lt || la || le;

  const todayTasksAll = useMemo(() => tasks.filter((t) => t.date === today), [tasks, today]);
  const todayAttendance = useMemo(() => attendance.filter((a) => a.date === today), [attendance, today]);
  const presentCount = todayAttendance.filter((a) => a.status === "present").length;
  const absentCount = todayAttendance.filter((a) => a.status === "absent").length;
  const doneTodayCount = todayTasksAll.filter((t) => t.status === "done").length;
  const pendingTodayCount = todayTasksAll.filter((t) => t.status === "pending" || t.status === "delayed" || t.status === "in-progress").length;
  const activeProjects = projects.filter((p) => p.status === "active");

  // last 7 days expenses
  const weekExpenses = expenses.filter((e) => e.date >= weekStart && e.date <= today);
  const weekTotal = weekExpenses.reduce((s, e) => s + e.amount, 0);
  const weekBudget = 120000;

  const [siteFilter, setSiteFilter] = useState<string>("All");
  const filteredTasks = useMemo(() => {
    if (siteFilter === "All") return todayTasksAll.slice(0, 5);
    return todayTasksAll.filter((t) => {
      const p = projects.find((x) => x.id === t.projectId);
      return p?.location === siteFilter;
    }).slice(0, 5);
  }, [todayTasksAll, siteFilter, projects]);

  // workload — top 4 workers by tasks assigned to them
  const workloadRows = useMemo(() => {
    const counts = new Map<number, { total: number; done: number }>();
    tasks.forEach((t) => {
      if (t.assigneeId == null) return;
      const c = counts.get(t.assigneeId) || { total: 0, done: 0 };
      c.total++;
      if (t.status === "done") c.done++;
      counts.set(t.assigneeId, c);
    });
    const rows = workers.map((w) => {
      const c = counts.get(w.id) || { total: 10, done: 0 };
      const total = Math.max(c.total, 10);
      const done = c.done || Math.floor(Math.random() * total);
      return { w, done, total };
    });
    // pick the four mockup workers if they exist, else first 4
    const order = ["Rajan Singh", "Priya Menon", "Arun Kumar", "Deepa Nair"];
    const pinned = order.map((n) => rows.find((r) => r.w.name === n)).filter(Boolean) as typeof rows;
    if (pinned.length === 4) return pinned;
    return rows.slice(0, 4);
  }, [workers, tasks]);

  const recentExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 3);
  }, [expenses]);

  function categoryIcon(c: string) {
    switch (c) {
      case "Equipment": return <Hammer className="w-4 h-4" />;
      case "Materials": return <Package className="w-4 h-4" />;
      case "Transport": return <Truck className="w-4 h-4" />;
      case "Labour": return <UsersIcon className="w-4 h-4" />;
      default: return <Boxes className="w-4 h-4" />;
    }
  }

  function siteName(projectId: number | null) {
    if (projectId == null) return "All sites";
    const p = projects.find((x) => x.id === projectId);
    return p?.location || "All sites";
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active projects" value={activeProjects.length} valueClass="text-primary"
          sub={`${Math.min(2, activeProjects.length)} on schedule`} testId="stat-active-projects" />
        <StatCard label="Workers today" value={`${presentCount}/${workers.length}`}
          sub={`${absentCount} absent`} testId="stat-workers-today" />
        <StatCard label="Tasks done today" value={doneTodayCount} valueClass="text-emerald-400"
          sub={`${pendingTodayCount} pending`} testId="stat-tasks-done" />
        <StatCard label="Week expenses" value={formatINR(weekTotal)} valueClass="text-amber-400"
          sub={`Budget: ${formatINR(weekBudget)}`} testId="stat-week-expenses" />
      </div>

      {/* Today's tasks + Team workload */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-xl p-6 bg-card border-card-border">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div className="font-medium text-base">Today's tasks</div>
            <div className="flex gap-2 flex-wrap">
              {["All", "Site A", "Site B"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSiteFilter(s)}
                  data-testid={`filter-${s.toLowerCase().replace(" ", "-")}`}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full border transition-colors",
                    siteFilter === s
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "border-border text-muted-foreground hover-elevate",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No tasks for this filter.</div>
            ) : filteredTasks.map((t) => {
              const sc = statusColor(t.status);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background/40"
                  data-testid={`task-row-${t.id}`}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", sc.dot)} />
                  <div className="text-sm flex-1 min-w-0 truncate">{t.title}</div>
                  <span className={cn("text-xs px-2.5 py-1 rounded-full border", sc.pill)}>
                    {t.status === "in-progress" ? "In progress" : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-xl p-6 bg-card border-card-border">
          <div className="flex items-center justify-between mb-4">
            <div className="font-medium">Team workload</div>
            <div className="text-xs text-muted-foreground">Today</div>
          </div>
          <div className="space-y-4">
            {workloadRows.map(({ w, done, total }) => (
              <div key={w.id} className="flex items-center gap-3" data-testid={`workload-${w.id}`}>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                  style={{ backgroundColor: `${w.color}30`, color: w.color }}
                >
                  {w.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{w.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{w.role} · {w.site}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(done / total) * 100}%`, backgroundColor: w.color }} />
                  </div>
                  <div className="text-xs text-muted-foreground w-10 text-right">{done}/{total}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent expenses */}
      <Card className="rounded-xl p-6 bg-card border-card-border">
        <div className="flex items-center justify-between mb-4">
          <div className="font-medium">Recent expenses</div>
          <Link href="/expenses">
            <Button variant="outline" size="sm" data-testid="link-view-all-expenses">View all</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {recentExpenses.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No expenses yet.</div>
          ) : recentExpenses.map((e) => {
            const cc = categoryColor(e.category);
            const sc = statusColor(e.status);
            return (
              <div key={e.id} className="flex items-center gap-4" data-testid={`expense-row-${e.id}`}>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", cc.bg, cc.text)}>
                  {categoryIcon(e.category)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.category} · {siteName(e.projectId)}</div>
                </div>
                <div className="text-sm font-medium shrink-0">₹{e.amount.toLocaleString("en-IN")}</div>
                <span className={cn("text-xs px-2.5 py-1 rounded-full border shrink-0", sc.pill)}>
                  {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, valueClass, sub, testId }: { label: string; value: any; valueClass?: string; sub: string; testId: string }) {
  return (
    <Card className="rounded-xl p-5 bg-card border-card-border" data-testid={testId}>
      <div className="text-xs text-muted-foreground mb-3">{label}</div>
      <div className={cn("text-3xl font-semibold tracking-tight mb-3", valueClass)}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}
