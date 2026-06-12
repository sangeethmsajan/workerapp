import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient, setViewingAsUserId, subscribeViewingAs, getViewingAsUserId } from "./queryClient";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "user";
  googleId: string | null;
  avatar: string | null;
  hasPassword: boolean;
  createdAt: string;
  isActive: number;
}

export interface AuthConfig {
  googleEnabled: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  config: AuthConfig | undefined;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, refetch } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()) as AuthUser;
    },
    retry: false,
    staleTime: 60_000,
  });

  const { data: config } = useQuery<AuthConfig>({
    queryKey: ["/api/auth/config"],
    queryFn: async () => {
      const res = await fetch("/api/auth/config", { credentials: "include" });
      if (!res.ok) return { googleEnabled: false };
      return (await res.json()) as AuthConfig;
    },
    retry: false,
    staleTime: Infinity,
  });

  const loginMut = useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", vars);
      return (await res.json()) as AuthUser;
    },
  });
  const signupMut = useMutation({
    mutationFn: async (vars: { name: string; email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/signup", vars);
      return (await res.json()) as AuthUser;
    },
  });
  const googleMut = useMutation({
    mutationFn: async (credential: string) => {
      const res = await apiRequest("POST", "/api/auth/google", { credential });
      return (await res.json()) as AuthUser;
    },
  });
  const logoutMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
  });

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading,
    config,
    async login(email, password) {
      await loginMut.mutateAsync({ email, password });
      await refetch();
      queryClient.invalidateQueries();
    },
    async signup(name, email, password) {
      await signupMut.mutateAsync({ name, email, password });
      await refetch();
      queryClient.invalidateQueries();
    },
    async loginWithGoogle(credential) {
      await googleMut.mutateAsync(credential);
      await refetch();
      queryClient.invalidateQueries();
    },
    async logout() {
      await logoutMut.mutateAsync();
      setViewingAsUserId(null);
      queryClient.clear();
      await refetch();
    },
    async refresh() {
      await refetch();
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
  }, [isLoading, user, setLocation]);
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "super_admin")) setLocation("/");
  }, [isLoading, user, setLocation]);
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user || user.role !== "super_admin") return null;
  return <>{children}</>;
}

// Hook to subscribe to viewing-as state from React.
import { useState } from "react";
export function useViewingAsUserId(): [number | null, (id: number | null) => void] {
  const [val, setVal] = useState<number | null>(getViewingAsUserId());
  useEffect(() => {
    const unsub = subscribeViewingAs((v) => setVal(v));
    return () => { unsub(); };
  }, []);
  return [val, (id) => {
    setViewingAsUserId(id);
    queryClient.invalidateQueries();
  }];
}
