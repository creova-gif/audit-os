import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  Briefcase, 
  AlertTriangle, 
  Search, 
  FileText, 
  Users, 
  FolderOpen,
  FileSpreadsheet,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/engagements", label: "Engagements", icon: Briefcase },
  { href: "/ledger-ingestion", label: "Ledger Fieldwork", icon: FileSpreadsheet },
  { href: "/anomalies", label: "Anomalies", icon: AlertTriangle },
  { href: "/findings", label: "Findings", icon: Search },
  { href: "/working-papers", label: "Working Papers", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/data-room", label: "Data Room", icon: FolderOpen },
  { href: "/client-portal", label: "Client Portal", icon: Globe },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-full border-r border-sidebar-border shadow-md">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-sidebar-primary" />
          AuditOS
        </h1>
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-slate-300 hover:text-white hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-xs text-slate-400">
        Practice Management v1.0
      </div>
    </aside>
  );
}
