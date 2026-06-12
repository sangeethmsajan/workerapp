import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HardHat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm: z.string().min(1, "Confirm your password"),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });
type FormVals = z.infer<typeof schema>;

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";

export default function Signup() {
  const { user, isLoading, signup, loginWithGoogle, config } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const googleDivRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });

  useEffect(() => {
    if (!isLoading && user) setLocation("/");
  }, [user, isLoading, setLocation]);

  const googleEnabled = !!GOOGLE_CLIENT_ID && (config?.googleEnabled ?? false);

  useEffect(() => {
    if (!googleEnabled) return;
    let cancelled = false;
    const SCRIPT_ID = "google-identity-services";
    const init = () => {
      if (cancelled) return;
      const g = (window as any).google;
      if (!g?.accounts?.id) return;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: any) => {
          try {
            await loginWithGoogle(resp.credential);
            setLocation("/");
          } catch (e: any) {
            toast({ title: "Google sign-up failed", description: e.message, variant: "destructive" });
          }
        },
      });
      if (googleDivRef.current) {
        g.accounts.id.renderButton(googleDivRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "signup_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 320,
        });
      }
    };
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) { init(); return; }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = init;
    document.head.appendChild(s);
    return () => { cancelled = true; };
  }, [googleEnabled, loginWithGoogle, setLocation, toast]);

  const onSubmit = async (vals: FormVals) => {
    setSubmitting(true);
    try {
      await signup(vals.name, vals.email, vals.password);
      setLocation("/");
    } catch (e: any) {
      toast({ title: "Sign-up failed", description: e.message?.includes("409") ? "Email already registered" : e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-8 rounded-xl bg-card border-card-border">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <HardHat className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-signup-title">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Get started with WorkTrack</p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-signup">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" autoComplete="name" {...form.register("name")} data-testid="input-name" />
            {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} data-testid="input-email" />
            {form.formState.errors.email && <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} data-testid="input-password" />
            {form.formState.errors.password && <p className="text-xs text-destructive mt-1">{form.formState.errors.password.message}</p>}
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} data-testid="input-confirm" />
            {form.formState.errors.confirm && <p className="text-xs text-destructive mt-1">{form.formState.errors.confirm.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={submitting} data-testid="button-signup">
            {submitting ? "Creating account…" : "Sign up"}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider"><span className="bg-card px-3 text-muted-foreground">or</span></div>
        </div>

        {googleEnabled ? (
          <div className="flex justify-center" ref={googleDivRef} data-testid="container-google-signup" />
        ) : (
          <p className="text-xs text-center text-muted-foreground" data-testid="text-google-disabled">Google Sign-In not configured</p>
        )}

        <p className="text-sm text-center text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline" data-testid="link-login">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
