import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  HardHat, LayoutDashboard, FolderKanban, ListChecks, Users, CalendarCheck,
  Wallet, Receipt, FileText, BarChart3, Settings as SettingsIcon, Menu, Plus,
  Shield, LogOut, ChevronDown, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { greeting } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import type { Settings, Project } from "@shared/schema";
import { NewTaskDialog } from "@/components/dialogs/NewTaskDialog";
import { NewProjectDialog } from "@/components/dialogs/NewProjectDialog";
import { useAuth, useViewingAsUserId } from "@/lib/auth";

interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; }
interface NavGroup { label: string; items: NavItem[]; }

const baseGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Daily tasks", href: "/tasks", icon: ListChecks },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Team & workers", href: "/team", icon: Users },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck },
      { label: "Payroll", href: "/payroll", icon: Wallet },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Expenses", href: "/expenses", icon: Receipt },
      { label: "Invoices", href: "/invoices", icon: FileText },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

const adminGroup: NavGroup = {
  label: "Admin",
  items: [
    { label: "Users", href: "/users", icon: Shield },
  ],
};

const COLORS = ["#8b5cf6", "#10b981", "#f97316", "#3b82f6", "#ec4899", "#14b8a6", "#f59e0b"];
function colorFor(id: number) { return COLORS[id % COLORS.length]; }
function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

function UserFooter({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  if (!user) return null;
  const isAdmin = user.role === "super_admin";
  const initial = initialsOf(user.name);

  if (collapsed) {
    return (
      <div className="px-2 pb-4 pt-2 border-t border-sidebar-border flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white hover-elevate focus:outline-none shrink-0 cursor-pointer"
              style={{ background: colorFor(user.id) }}
              data-testid="button-user-menu"
            >
              {initial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-56">
            <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground font-light">
              <span className="font-semibold text-foreground block">{user.name}</span>
              {user.email}
            </div>
            <DropdownMenuItem onClick={() => { onNavigate?.(); setLocation("/settings"); }} data-testid="menu-settings">
              <SettingsIcon className="w-4 h-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                onNavigate?.();
                await logout();
                setLocation("/login");
              }}
              data-testid="menu-logout"
            >
              <LogOut className="w-4 h-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="px-3 pb-4 pt-2 border-t border-sidebar-border">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover-elevate text-left cursor-pointer"
            data-testid="button-user-menu"
          >
            {user.avatar && user.avatar.startsWith("http") ? (
              <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0"
                style={{ background: colorFor(user.id) }}
                data-testid="img-user-avatar"
              >
                {initialsOf(user.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" data-testid="text-user-name">{user.name}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                {isAdmin && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]" data-testid="badge-admin">Admin</Badge>}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuItem onClick={() => { onNavigate?.(); setLocation("/settings"); }} data-testid="menu-settings">
            <SettingsIcon className="w-4 h-4 mr-2" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              onNavigate?.();
              await logout();
              setLocation("/login");
            }}
            data-testid="menu-logout"
          >
            <LogOut className="w-4 h-4 mr-2" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarContent({
  onNavigate,
  collapsed,
  onClose,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onClose?: () => void;
}) {
  const [location] = useLocation();
  const { user } = useAuth();
  const groups: NavGroup[] = user?.role === "super_admin" ? [...baseGroups, adminGroup] : baseGroups;
  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground overflow-hidden" data-testid="sidebar">
      <div className={cn("px-5 py-6 border-b border-sidebar-border flex items-center justify-between gap-3", collapsed && "justify-center px-2 gap-0")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center gap-0")}>
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-base animate-in fade-in truncate" data-testid="text-logo">WorkTrack</div>
              <div className="text-xs text-muted-foreground animate-in fade-in truncate">Field &amp; project management</div>
            </div>
          )}
        </div>
        {!collapsed && onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-primary shrink-0 transition-colors cursor-pointer"
            onClick={onClose}
            data-testid="button-close-sidebar"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-6">
        {groups.map((group) => (
          <div key={group.label} className={cn("space-y-2", collapsed && "flex flex-col items-center")}>
            {!collapsed ? (
              <div className="px-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
                {group.label}
              </div>
            ) : (
              <div className="w-full px-2 opacity-40"><Separator /></div>
            )}
            <div className="space-y-1 w-full">
              {group.items.map((item) => {
                const active = location === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover-elevate",
                      active
                        ? "bg-sidebar-accent text-primary font-medium"
                        : "text-sidebar-foreground/80",
                      collapsed && "justify-center px-0 h-10 w-10 shrink-0"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <UserFooter onNavigate={onNavigate} collapsed={collapsed} />
    </div>
  );
}

function ViewingAsBanner() {
  const { user } = useAuth();
  const [viewing, setViewing] = useViewingAsUserId();
  const { data: users } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user && user.role === "super_admin" && viewing != null,
  });
  if (!user || user.role !== "super_admin" || viewing == null) return null;
  const viewed = users?.find((u) => u.id === viewing);
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 md:px-8 py-2.5 flex items-center justify-between gap-3" data-testid="banner-viewing-as">
      <div className="text-sm">
        <span className="font-medium text-amber-600 dark:text-amber-400">Viewing data as</span>{" "}
        <span data-testid="text-viewing-name">{viewed?.name ?? `user #${viewing}`}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setViewing(null)} data-testid="button-exit-view-as">
        <X className="w-4 h-4 mr-1" /> Exit
      </Button>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const { data: projects } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { user } = useAuth();

  const userName = settings?.userName || user?.name || "there";
  const activeSites = projects?.filter((p) => p.status === "active").length ?? 0;
  
  const dateStr = settings?.timezone
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: settings.timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date())
    : format(new Date(), "EEEE, d LLLL yyyy");


  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* desktop sidebar */}
      <aside className={cn(
        "hidden md:flex shrink-0 border-r border-sidebar-border h-screen sticky top-0 transition-all duration-300 relative",
        collapsed ? "w-[64px]" : "w-[240px]"
      )}>
        <SidebarContent collapsed={collapsed} />
        <button
          onClick={toggleCollapsed}
          className="absolute top-6 -right-3 z-40 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary shadow-md flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95"
          data-testid="button-toggle-sidebar"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* mobile sidebar (sheet) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="p-0 w-[240px] bg-sidebar [&>button]:hidden border-r border-sidebar-border">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
          <SidebarContent onNavigate={() => setSheetOpen(false)} onClose={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* main */}
      <main className="flex-1 min-w-0 flex flex-col h-full">
        <ViewingAsBanner />
        <div className="px-4 md:px-8 py-6 flex-1 flex flex-col h-full overflow-auto">
          <div className="flex items-start gap-4 mb-8 flex-wrap md:flex-nowrap">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden shrink-0 bg-background/50 backdrop-blur-sm border-border hover:bg-accent/50 transition-all hover:scale-105 active:scale-95 duration-200"
              onClick={() => setSheetOpen(true)}
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold tracking-tight" data-testid="text-greeting">
                {greeting()}, {userName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-date">
                {dateStr} — {activeSites} sites active
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => setTaskOpen(true)} data-testid="button-new-task">
                <Plus className="w-4 h-4 mr-1.5" /> New task
              </Button>
              <Button variant="outline" onClick={() => setProjectOpen(true)} data-testid="button-new-project">
                <Plus className="w-4 h-4 mr-1.5" /> New project
              </Button>
            </div>
          </div>
          <div className="flex-1">{children}</div>
        </div>
      </main>

      <NewTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
      <NewProjectDialog open={projectOpen} onOpenChange={setProjectOpen} />
    </div>
  );
}
