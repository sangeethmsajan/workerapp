import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Attendance, Worker } from "@shared/schema";
import { formatINRFull } from "@/lib/format";
import { cn } from "@/lib/utils";

function monthRange(month: string): { start: string; end: string } {
  // month is YYYY-MM
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = new Date(y, m, 0); // last day of month
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const { data: workers = [], isLoading: lw } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: attendance = [], isLoading: la } = useQuery<Attendance[]>({ queryKey: ["/api/attendance"] });
  const [paid, setPaid] = useState<Record<number, boolean>>({});

  const { start, end } = monthRange(month);

  const rows = useMemo(() => workers.map((w) => {
    const days = attendance.filter((a) => a.workerId === w.id && a.date >= start && a.date <= end && a.status === "present").length;
    const due = days * w.dailyWage;
    return { w, days, due };
  }), [workers, attendance, start, end]);

  const totalDays = rows.reduce((s, r) => s + r.days, 0);
  const totalDue = rows.reduce((s, r) => s + r.due, 0);

  if (lw || la) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Payroll</h2>
          <p className="text-sm text-muted-foreground">Auto-calculated from attendance</p>
        </div>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" data-testid="input-payroll-month" />
      </div>

      <Card className="rounded-xl bg-card border-card-border overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
          <div className="col-span-4">Worker</div>
          <div className="col-span-2">Daily wage</div>
          <div className="col-span-2">Days present</div>
          <div className="col-span-2">Amount due</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        <div className="divide-y divide-border">
          {rows.map(({ w, days, due }) => (
            <div key={w.id} className="grid grid-cols-12 px-5 py-3 items-center text-sm" data-testid={`row-payroll-${w.id}`}>
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ backgroundColor: `${w.color}30`, color: w.color }}>{w.avatar}</div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{w.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{w.role}</div>
                </div>
              </div>
              <div className="col-span-2">{formatINRFull(w.dailyWage)}</div>
              <div className="col-span-2">{days}</div>
              <div className="col-span-2 font-medium">{formatINRFull(due)}</div>
              <div className="col-span-2 text-right">
                <button
                  onClick={() => setPaid((p) => ({ ...p, [w.id]: !p[w.id] }))}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border",
                    paid[w.id] ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
                  )}
                  data-testid={`button-pay-${w.id}`}
                >
                  {paid[w.id] ? "Paid" : "Pending"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-12 px-5 py-3 items-center text-sm bg-background/30 border-t border-border">
          <div className="col-span-4 font-medium">Totals</div>
          <div className="col-span-2"></div>
          <div className="col-span-2 font-medium" data-testid="text-total-days">{totalDays} days</div>
          <div className="col-span-2 font-medium" data-testid="text-total-due">{formatINRFull(totalDue)}</div>
          <div className="col-span-2"></div>
        </div>
      </Card>
    </div>
  );
}
