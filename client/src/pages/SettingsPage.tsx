import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Settings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, refresh, config } = useAuth();
  const { data: settings, isLoading } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const [userName, setUserName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("₹");
  const [timezone, setTimezone] = useState("UTC");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Google link button ref
  const linkBtnRef = useRef<HTMLDivElement>(null);
  const googleEnabled = !!GOOGLE_CLIENT_ID && (config?.googleEnabled ?? false);

  useEffect(() => {
    if (settings) {
      setUserName(settings.userName);
      setCompanyName(settings.companyName);
      setCurrency(settings.currency);
      setTimezone(settings.timezone || "UTC");
    }
  }, [settings]);

  const mut = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/settings/1", { userName, companyName, currency, timezone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changePass = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword }),
    onSuccess: async () => {
      toast({ title: "Password updated" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      await refresh();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message?.includes("401") ? "Current password is incorrect" : e.message, variant: "destructive" }),
  });

  const linkGoogle = useMutation({
    mutationFn: async (credential: string) => apiRequest("POST", "/api/auth/link-google", { credential }),
    onSuccess: async () => { toast({ title: "Google account linked" }); await refresh(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unlinkGoogle = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/auth/unlink-google"),
    onSuccess: async () => { toast({ title: "Google account unlinked" }); await refresh(); },
    onError: (e: any) => toast({ title: "Error", description: e.message?.includes("400") ? "Set a password before unlinking Google" : e.message, variant: "destructive" }),
  });

  // Render Google "Link" button when applicable
  useEffect(() => {
    if (!googleEnabled || !user || user.googleId) return;
    let cancelled = false;
    const SCRIPT_ID = "google-identity-services";
    const init = () => {
      if (cancelled) return;
      const g = (window as any).google;
      if (!g?.accounts?.id || !linkBtnRef.current) return;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: any) => { linkGoogle.mutate(resp.credential); },
      });
      g.accounts.id.renderButton(linkBtnRef.current, {
        type: "standard", theme: "outline", size: "medium", text: "continue_with", shape: "rectangular",
      });
    };
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) { init(); return; }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = init;
    document.head.appendChild(s);
    return () => { cancelled = true; };
  }, [googleEnabled, user, linkGoogle]);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Customize your profile and account</p>
      </div>

      <Card className="rounded-xl p-6 bg-card border-card-border max-w-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Profile</h3>
          </div>
          <div>
            <Label>Your name</Label>
            <Input value={userName} onChange={(e) => setUserName(e.target.value)} data-testid="input-username" />
          </div>
          <div>
            <Label>Company name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} data-testid="input-company" />
          </div>
          <div>
            <Label>Currency symbol</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-32" data-testid="input-currency" />
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <div className="w-full max-w-sm">
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone" className="w-full" data-testid="select-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">Coordinated Universal Time (UTC)</SelectItem>
                  <SelectItem value="Asia/Kolkata">Indian Standard Time (IST - Asia/Kolkata)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Standard Time (EST/EDT - America/New_York)</SelectItem>
                  <SelectItem value="America/Chicago">Central Standard Time (CST/CDT - America/Chicago)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Standard Time (PST/PDT - America/Los_Angeles)</SelectItem>
                  <SelectItem value="Europe/London">Greenwich Mean Time (GMT/BST - Europe/London)</SelectItem>
                  <SelectItem value="Europe/Paris">Central European Time (CET/CEST - Europe/Paris)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Japan Standard Time (JST - Asia/Tokyo)</SelectItem>
                  <SelectItem value="Asia/Singapore">Singapore Standard Time (SGT - Asia/Singapore)</SelectItem>
                  <SelectItem value="Australia/Sydney">Australian Eastern Standard Time (AEST/AEDT - Australia/Sydney)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending} data-testid="button-save-settings">
              {mut.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-xl p-6 bg-card border-card-border max-w-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Account</h3>
            {user?.role === "super_admin" && <Badge variant="secondary">Admin</Badge>}
          </div>
          <div className="text-sm text-muted-foreground" data-testid="text-account-email">
            Signed in as <span className="text-foreground font-medium">{user?.email}</span>
          </div>

          {/* Change password */}
          <div className="pt-2 border-t border-border space-y-3">
            <h4 className="text-sm font-semibold">{user?.hasPassword ? "Change password" : "Set a password"}</h4>
            {user?.hasPassword && (
              <div>
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
              </div>
            )}
            <div>
              <Label>New password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password"
              />
            </div>
            <Button
              onClick={() => {
                if (newPassword.length < 6) { toast({ title: "Password too short", description: "Use at least 6 characters", variant: "destructive" }); return; }
                if (newPassword !== confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
                changePass.mutate();
              }}
              disabled={changePass.isPending}
              data-testid="button-change-password"
            >
              {changePass.isPending ? "Saving…" : (user?.hasPassword ? "Update password" : "Set password")}
            </Button>
          </div>

          {/* Google linking */}
          <div className="pt-4 border-t border-border space-y-3">
            <h4 className="text-sm font-semibold">Google Sign-In</h4>
            {!googleEnabled ? (
              <p className="text-xs text-muted-foreground" data-testid="text-google-disabled">Google Sign-In is not configured on this server.</p>
            ) : user?.googleId ? (
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <div>Connected as <span className="font-medium">{user.email}</span></div>
                  {!user.hasPassword && (
                    <div className="text-xs text-muted-foreground mt-1">Set a password before unlinking Google</div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unlinkGoogle.mutate()}
                  disabled={!user.hasPassword || unlinkGoogle.isPending}
                  data-testid="button-unlink-google"
                >
                  Unlink
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Link your Google account to sign in faster.</p>
                <div ref={linkBtnRef} data-testid="container-link-google" />
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
