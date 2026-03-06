"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { getStatusLabel } from "@/components/ui/status-badge";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface SidebarProps {
  navItems: NavItem[];
  userName: string;
  userRole: string;
  userId: string;
}

interface SearchResult {
  id: string;
  refNumber: string;
  clientName: string;
  clientPhone: string;
  status: string;
  assignedTo: { name: string } | null;
}

function getTicketPath(role: string, ticketId: string): string {
  if (role === "SUPER_ADMIN") return `/super-admin/tickets/${ticketId}`;
  if (role === "SALES" || role === "SALES_MANAGER") return `/sales/tickets/${ticketId}`;
  return `/admin/tickets/${ticketId}`;
}

const STATUS_DOT: Record<string, string> = {
  LEAD: "bg-blue-400",
  DOC_COLLECTION: "bg-yellow-400",
  SUBMITTED: "bg-purple-400",
  IN_PROGRESS: "bg-orange-400",
  APPROVED: "bg-green-400",
  REJECTED: "bg-red-400",
  ON_HOLD: "bg-gray-400",
};

export function Sidebar({ navItems, userName, userRole, userId }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearch(query: string) {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowResults(true);
        }
      } catch {
        // silently fail
      }
      setSearching(false);
    }, 300);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-text">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white">
          A
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Abbey CRM</p>
          <p className="text-xs text-sidebar-text">{userRole.replace("_", " ")}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative px-3 pt-4" ref={searchRef}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
          placeholder="Search cases..."
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:border-primary focus:bg-white/15"
        />
        {searching && (
          <div className="absolute right-5 top-6.5 text-xs text-white/50">...</div>
        )}

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
            {searchResults.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted">No results found</div>
            ) : (
              searchResults.map((result) => (
                <Link
                  key={result.id}
                  href={getTicketPath(userRole, result.id)}
                  onClick={() => { setShowResults(false); setSearchQuery(""); }}
                  className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-gray-50"
                >
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[result.status] || "bg-gray-400"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{result.clientName}</p>
                    <p className="text-xs text-muted">
                      {result.refNumber} &bull; {getStatusLabel(result.status)}
                      {result.assignedTo && <> &bull; {result.assignedTo.name}</>}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {(() => {
          // Find the longest matching nav href so only the most specific item is highlighted
          const activeHref = navItems
            .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
            .sort((a, b) => b.href.length - a.href.length)[0]?.href;

          return navItems.map((item) => {
            const isActive = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-active text-white"
                    : "text-sidebar-text hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          });
        })()}
      </nav>

      {/* User Section */}
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-sidebar-text">{userRole.replace("_", " ")}</p>
          </div>
          <NotificationBell userId={userId} userRole={userRole} />
        </div>
        <button
          onClick={handleLogout}
          className="w-full rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-sidebar-text transition-colors hover:bg-white/10 hover:text-white"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
