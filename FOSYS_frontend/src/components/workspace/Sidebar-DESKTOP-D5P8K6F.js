import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  CheckSquare,
  GitPullRequest,
  Calendar,
  User,
  LayoutDashboard,
  FolderKanban,
  Users,
  Menu,
  X,
} from "lucide-react";

/**
 * Sidebar component — improved:
 * - Responsive collapse for small screens
 * - Accessible buttons and testids
 * - Visual active item highlight
 */

const Sidebar = ({ role = "intern" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const getNavItems = () => {
    const lower = role?.toLowerCase();
    switch (lower) {
      case "intern":
      case "employee":
        return [
          { icon: Home, label: "HOME", path: `/dashboard/${lower}`, testId: "nav-home" },
          { icon: CheckSquare, label: "TASKS", path: `/dashboard/${lower}/tasks`, testId: "nav-tasks" },
          { icon: GitPullRequest, label: "PRS", path: `/dashboard/${lower}/prs`, testId: "nav-prs" },
          { icon: Calendar, label: "PLANNER", path: `/dashboard/${lower}/planner`, testId: "nav-planner" },
          { icon: User, label: "PROFILE", path: `/dashboard/${lower}/profile`, testId: "nav-profile" },
        ];
      case "manager":
        return [
          { icon: Home, label: "HOME", path: `/dashboard/${lower}`, testId: "nav-home" },
          { icon: FolderKanban, label: "PROJECTS", path: `/dashboard/${lower}/projects`, testId: "nav-projects" },
          { icon: GitPullRequest, label: "PRS", path: `/dashboard/${lower}/prs`, testId: "nav-prs" },
          { icon: Users, label: "USER MGMT", path: `/dashboard/${lower}/overview`, testId: "nav-overview" },
          { icon: Calendar, label: "PLANNER", path: `/dashboard/${lower}/planner`, testId: "nav-planner" },
          { icon: User, label: "PROFILE", path: `/dashboard/${lower}/profile`, testId: "nav-profile" },
        ];
      case "admin":
        return [
          { icon: Home, label: "HOME", path: `/dashboard/${lower}`, testId: "nav-home" },
          { icon: FolderKanban, label: "PROJECTS", path: `/dashboard/${lower}/projects`, testId: "nav-projects" },
          { icon: Users, label: "USERS", path: `/dashboard/${lower}/users`, testId: "nav-users" },
          { icon: LayoutDashboard, label: "SYSTEM", path: `/dashboard/${lower}/system`, testId: "nav-system" },
          { icon: User, label: "PROFILE", path: `/dashboard/${lower}/profile`, testId: "nav-profile" },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile toggle */}
      <button
        aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
        onClick={() => setCollapsed((c) => !c)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900/80 text-white rounded shadow"
        data-testid="sidebar-toggle"
      >
        {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
      </button>

      <aside
        className={`fixed left-0 top-0 h-screen z-40 bg-slate-900 border-r border-slate-800 transition-transform duration-300 ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        } w-64 md:translate-x-0`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <img src="/assets/logo.jpg" alt="FOSYS" className="h-10 w-10 rounded-lg" />
          <div>
            <div className="text-xl font-bold text-white">FOSYS</div>
            <div className="text-xs text-slate-400">Workspace</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                data-testid={item.testId}
                onClick={() => {
                  navigate(item.path);
                  // auto-collapse on mobile
                  if (window.innerWidth < 768) setCollapsed(true);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-left transition-all ${
                  active
                    ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer / role */}
        <div className="mt-auto p-4 border-t border-slate-800 text-slate-400 text-xs">
          <div className="mb-1">Signed in as:</div>
          <div className="font-medium text-white truncate" title={role}>{role?.toString()?.toUpperCase()}</div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
