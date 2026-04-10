import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { path: "/agents", label: "Agent Registry", icon: Bot, section: "Management" },
  { path: "/policies", label: "Data Policies", icon: Shield, section: "Management" },
  { path: "/approvals", label: "Approval Queue", icon: ClipboardCheck, section: "Management", badge: "pending" },
  { path: "/audit", label: "Audit Trail", icon: Eye, section: "Monitoring" },
  { path: "/risk", label: "Risk Scoring", icon: TrendingUp, section: "Monitoring" },
  { path: "/shadow-ai", label: "Shadow AI", icon: ShieldAlert, section: "Monitoring" },
  { path: "/vendor", label: "Vendor Transparency", icon: Users, section: "Monitoring" },
  { path: "/analysis", label: "LLM Analysis", icon: Brain, section: "Intelligence" },
  { path: "/compliance", label: "Compliance", icon: ShieldCheck, section: "Intelligence" },
  { path: "/notifications", label: "Notifications", icon: Bell, section: "Intelligence", badge: "unread" },
];

interface AegisLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AegisLayout({ children, title }: AegisLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const handleLogout = () => { logout(); };

  const { data: stats } = trpc.dashboard.stats.useQuery(undefined, { enabled: isAuthenticated });
  const pendingCount = stats?.pendingApprovals ?? 0;
  const unreadCount = stats?.unreadNotifications ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Loading Aegis...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md px-6">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Aegis</h1>
              <p className="text-xs text-muted-foreground">AI Governance Platform</p>
            </div>
          </div>
          <p className="text-muted-foreground">Sign in to access your AI governance dashboard.</p>
          <Button asChild className="w-full">
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </div>
      </div>
    );
  }

  const sections = Array.from(new Set(navItems.map((n) => n.section)));

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out shrink-0",
          collapsed ? "w-[60px]" : "w-[240px]"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center border-b border-sidebar-border h-16 px-3 shrink-0", collapsed ? "justify-center" : "gap-3 px-4")}>
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground leading-none">Aegis</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">AI Governance</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {sections.map((section) => (
            <div key={section}>
              {!collapsed && (
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-1.5">{section}</p>
              )}
              <div className="space-y-0.5">
                {navItems
                  .filter((n) => n.section === section)
                  .map((item) => {
                    const isActive = location === item.path || location.startsWith(item.path + "/");
                    const badgeCount = item.badge === "pending" ? pendingCount : item.badge === "unread" ? unreadCount : 0;
                    const Icon = item.icon;

                    const navLink = (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-all duration-150 group relative",
                          isActive
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          collapsed && "justify-center px-2"
                        )}
                      >
                        <Icon className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && badgeCount > 0 && (
                          <Badge variant="destructive" className="ml-auto text-[10px] h-4 min-w-4 px-1">
                            {badgeCount}
                          </Badge>
                        )}
                        {collapsed && badgeCount > 0 && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
                        )}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.path} delayDuration={0}>
                          <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            {item.label}
                            {badgeCount > 0 && ` (${badgeCount})`}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    return navLink;
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-sidebar-border p-2 space-y-1 shrink-0">
          {!collapsed && user && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-semibold text-primary">
                  {(user.name ?? "U").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{user.name ?? "User"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email ?? ""}</p>
              </div>
            </div>
          )}
          <div className={cn("flex gap-1", collapsed ? "flex-col" : "")}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("text-muted-foreground hover:text-foreground", collapsed ? "w-full justify-center px-2" : "flex-1")}
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4" />
                  {!collapsed && <span className="ml-2 text-xs">Sign Out</span>}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Sign Out</TooltipContent>}
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("text-muted-foreground hover:text-foreground shrink-0", collapsed ? "w-full justify-center px-2" : "")}
                  onClick={() => setCollapsed(!collapsed)}
                >
                  {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{collapsed ? "Expand" : "Collapse"}</TooltipContent>}
            </Tooltip>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {title && (
              <h1 className="text-base font-semibold text-foreground">{title}</h1>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/notifications">
              <Button variant="ghost" size="sm" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />
                )}
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-green-400" />
              <span>System Operational</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
