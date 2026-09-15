"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ApprovedStaff } from "@/lib/auth/require-approved-staff";
import { signOut } from "@/app/auth/actions";
import { useState } from "react";

type WorkspaceNavProps = {
  staff: ApprovedStaff;
};

export function WorkspaceNav({ staff }: WorkspaceNavProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { name: "Schedule", href: "/dashboard/schedule", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { name: "History", href: "/dashboard/history", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    { name: "Notifications", href: "/dashboard/notifications", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
    { name: "Profile", href: "/dashboard/profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  ];

  if (staff.is_admin) {
    navItems.push({ name: "Admin", href: "/dashboard/admin", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" });
  }

  const initials = staff.email.substring(0, 2).toUpperCase();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-zinc-800 bg-zinc-950/50 backdrop-blur-xl h-full fixed top-0 left-0 z-40">
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Workspace
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-800/80 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  {item.name === "Admin" && (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                </svg>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-zinc-800/50 transition text-left"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-500/30 shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{staff.email}</p>
                <p className="text-xs text-zinc-500 truncate">{staff.is_admin ? "Administrator" : "Employee"}</p>
              </div>
            </button>

            {isMenuOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden py-1 z-50">
                <form action={signOut}>
                  <button type="submit" className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition">
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl z-40 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

