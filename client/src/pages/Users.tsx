import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, useViewingAsUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Eye } from "lucide-react";
import { useLocation } from "wouter";

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "user";
  avatar: string | null;
  googleId: string | null;
  hasPassword: boolean;
  createdAt: string;
  isActive: number;
  projectCount: number;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

const COLORS = ["#8b5cf6", "#10b981", "#f97316", "#3b82f6", "#ec4899", "#14b8a6", "#f59e0b"];
function colorFor(id: number) { return COLORS[id % COLORS.length]; }

export default function Users() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [, setViewingAs] = useViewingAsUserId();
  const [, setLocation] = useLocation();
  const { data: users, isLoading } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"] });

  const toggleActive = useMutation({
    mutationFn: async (vars: { id: number; isActive: number }) => {
      await apiRequest("PATCH", `/api/admin/users/${vars.id}`, { isActive: vars.isActive });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-users-title">Users</h2>
        <p className="text-sm text-muted-foreground">Manage WorkTrack accounts and view their data</p>
      </div>

      <Card className="rounded-xl bg-card border-card-border overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-64 rounded-lg" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {u.avatar && u.avatar.startsWith("http") ? (
                        <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                          style={{ background: colorFor(u.id) }}
                        >
                          {initials(u.name)}
                        </div>
                      )}
                      <span className="font-medium" data-testid={`text-name-${u.id}`}>{u.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm" data-testid={`text-email-${u.id}`}>{u.email}</TableCell>
                  <TableCell>
                    {u.role === "super_admin" ? (
                      <Badge variant="default" data-testid={`badge-role-${u.id}`}>Admin</Badge>
                    ) : (
                      <Badge variant="secondary" data-testid={`badge-role-${u.id}`}>User</Badge>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-projects-${u.id}`}>{u.projectCount}</TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-500" data-testid={`badge-status-${u.id}`}>Active</Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground" data-testid={`badge-status-${u.id}`}>Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(u.createdAt), "d LLL yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      {currentUser?.id !== u.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setViewingAs(u.id);
                            setLocation("/");
                          }}
                          data-testid={`button-view-as-${u.id}`}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View as
                        </Button>
                      )}
                      {currentUser?.id !== u.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive.mutate({ id: u.id, isActive: u.isActive ? 0 : 1 })}
                          data-testid={`button-toggle-${u.id}`}
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
