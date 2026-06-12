export function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  return `₹${amount}`;
}

export function formatINRFull(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function statusColor(status: string): { dot: string; pill: string } {
  switch (status) {
    case "done":
    case "paid":
    case "approved":
    case "present":
      return { dot: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
    case "in-progress":
    case "sent":
      return { dot: "bg-violet-500", pill: "bg-violet-500/15 text-violet-300 border-violet-500/20" };
    case "delayed":
    case "overdue":
      return { dot: "bg-amber-500", pill: "bg-amber-500/15 text-amber-400 border-amber-500/20" };
    case "absent":
      return { dot: "bg-rose-500", pill: "bg-rose-500/15 text-rose-400 border-rose-500/20" };
    case "leave":
      return { dot: "bg-sky-500", pill: "bg-sky-500/15 text-sky-400 border-sky-500/20" };
    case "draft":
      return { dot: "bg-zinc-500", pill: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" };
    case "pending":
    default:
      return { dot: "bg-zinc-500", pill: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" };
  }
}

export function categoryColor(category: string): { bg: string; text: string } {
  switch (category) {
    case "Equipment": return { bg: "bg-violet-500/15", text: "text-violet-300" };
    case "Materials": return { bg: "bg-emerald-500/15", text: "text-emerald-300" };
    case "Transport": return { bg: "bg-amber-500/15", text: "text-amber-300" };
    case "Labour": return { bg: "bg-sky-500/15", text: "text-sky-300" };
    case "Other":
    default: return { bg: "bg-zinc-500/15", text: "text-zinc-300" };
  }
}

export function getLocalDateInTimezone(timezone: string = "UTC"): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const d = parts.find((p) => p.type === "day")!.value;
    return `${y}-${m}-${d}`;
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

export function getLocalDateOffsetInTimezone(days: number, timezone: string = "UTC"): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // Calculate current time at target timezone first, then offset it.
    const now = new Date();
    const parts = formatter.formatToParts(now);
    const y = parseInt(parts.find((p) => p.type === "year")!.value, 10);
    const m = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
    const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
    
    const targetDate = new Date(y, m, d);
    targetDate.setDate(targetDate.getDate() + days);
    
    const y2 = targetDate.getFullYear();
    const m2 = String(targetDate.getMonth() + 1).padStart(2, "0");
    const d2 = String(targetDate.getDate()).padStart(2, "0");
    return `${y2}-${m2}-${d2}`;
  } catch (e) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
}

