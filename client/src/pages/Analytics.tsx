import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Attendance, Expense, Task } from "@shared/schema";
import { formatINR, isoOffset } from "@/lib/format";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid,
} from "recharts";
import { format } from "date-fns";

const COLORS = ["#a78bfa", "#34d399", "#fb923c", "#38bdf8", "#a1a1aa"];

export default function AnalyticsPage() {
  const { data: tasks = [], isLoading: lt } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: attendance = [], isLoading: la } = useQuery<Attendance[]>({ queryKey: ["/api/attendance"] });
  const { data: expenses = [], isLoading: le } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });

  const isLoading = lt || la || le;

  // last 14 days
  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 13; i >= 0; i--) arr.push(isoOffset(-i));
    return arr;
  }, []);

  const tasksPerDay = useMemo(() => days.map((d) => ({
    day: format(new Date(d), "dd MMM"),
    done: tasks.filter((t) => t.date === d && t.status === "done").length,
  })), [days, tasks]);

  // weekly expenses (8 weeks)
  const weeks = useMemo(() => {
    const arr: { label: string; start: string; end: string }[] = [];
    for (let w = 7; w >= 0; w--) {
      const start = isoOffset(-((w * 7) + 6));
      const end = isoOffset(-(w * 7));
      arr.push({ label: format(new Date(end), "dd MMM"), start, end });
    }
    return arr;
  }, []);
  const weekExpenses = useMemo(() => weeks.map((w) => ({
    week: w.label,
    total: expenses.filter((e) => e.date >= w.start && e.date <= w.end).reduce((s, e) => s + e.amount, 0),
  })), [weeks, expenses]);

  // expense breakdown by category
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    expenses.forEach((e) => m.set(e.category, (m.get(e.category) || 0) + e.amount));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // attendance rate per day
  const attendanceRate = useMemo(() => days.map((d) => {
    const day = attendance.filter((a) => a.date === d);
    const present = day.filter((a) => a.status === "present").length;
    const rate = day.length ? Math.round((present / day.length) * 100) : 0;
    return { day: format(new Date(d), "dd MMM"), rate };
  }), [days, attendance]);

  // summary cards
  const avgAtt = Math.round(attendanceRate.reduce((s, d) => s + d.rate, 0) / Math.max(attendanceRate.length, 1));
  const monthStart = isoOffset(-30);
  const expensesMTD = expenses.filter((e) => e.date >= monthStart).reduce((s, e) => s + e.amount, 0);
  const tasksMTD = tasks.filter((t) => t.date >= monthStart && t.status === "done").length;
  const onTimeTasks = tasks.length === 0 ? 100 : Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);

  if (isLoading) return <div className="space-y-4">{[0,1,2].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="text-sm text-muted-foreground">Site performance, costs, and attendance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Summary label="Avg attendance" value={`${avgAtt}%`} color="text-emerald-400" />
        <Summary label="Expenses (30d)" value={formatINR(expensesMTD)} color="text-amber-400" />
        <Summary label="Tasks completed (30d)" value={tasksMTD} color="text-primary" />
        <Summary label="On-time tasks" value={`${onTimeTasks}%`} color="text-sky-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-xl p-5 bg-card border-card-border">
          <div className="font-medium mb-3">Tasks completed (last 14 days)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tasksPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--card-border))", borderRadius: 8 }} />
                <Bar dataKey="done" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-xl p-5 bg-card border-card-border">
          <div className="font-medium mb-3">Weekly expenses trend (8 weeks)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekExpenses}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--card-border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="total" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-xl p-5 bg-card border-card-border">
          <div className="font-medium mb-3">Expense breakdown</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {byCategory.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--card-border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-xl p-5 bg-card border-card-border">
          <div className="font-medium mb-3">Attendance rate (last 14 days)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceRate}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--card-border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="rate" stroke="#34d399" fill="url(#attGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Summary({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <Card className="rounded-xl p-4 bg-card border-card-border" data-testid={`summary-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </Card>
  );
}
