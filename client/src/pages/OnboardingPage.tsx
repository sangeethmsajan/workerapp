import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Globe } from "lucide-react";

const TIMEZONES = [
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "Asia/Kolkata", label: "Indian Standard Time (IST - Asia/Kolkata)" },
  { value: "America/New_York", label: "Eastern Standard Time (EST/EDT - America/New_York)" },
  { value: "America/Chicago", label: "Central Standard Time (CST/CDT - America/Chicago)" },
  { value: "America/Los_Angeles", label: "Pacific Standard Time (PST/PDT - America/Los_Angeles)" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT/BST - Europe/London)" },
  { value: "Europe/Paris", label: "Central European Time (CET/CEST - Europe/Paris)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST - Asia/Tokyo)" },
  { value: "Asia/Singapore", label: "Singapore Standard Time (SGT - Asia/Singapore)" },
  { value: "Australia/Sydney", label: "Australian Eastern Standard Time (AEST/AEDT - Australia/Sydney)" },
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [timezone, setTimezone] = useState("UTC");

  const mut = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/settings/1", { timezone, onboarded: 1 });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Timezone configured successfully" });
      setLocation("/");
    },
    onError: (e: any) => {
      toast({
        title: "Configuration failed",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-8 rounded-xl bg-card border-card-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Globe className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Configure Workspace</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select your timezone to sync dates, tasks, and daily logs correctly.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-sm font-medium">Select Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" className="w-full" data-testid="select-timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value} data-testid={`timezone-option-${tz.value.replace(/\//g, "-")}`}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => mut.mutate()}
            className="w-full"
            disabled={mut.isPending}
            data-testid="button-save-onboarding"
          >
            {mut.isPending ? "Configuring..." : "Get Started"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
