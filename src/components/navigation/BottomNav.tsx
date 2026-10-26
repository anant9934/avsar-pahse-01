"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Bookmark, ClipboardCheck, User } from "lucide-react";

interface BottomNavProps {
  savedCount?: number;
  appliedCount?: number;
  fluid?: boolean;
}

export function BottomNav({ savedCount, appliedCount, fluid = false }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Home",
      href: "/home",
      icon: Home,
      isActive: pathname === "/home" || pathname === "/",
    },
    {
      label: "Explore",
      href: "/explore",
      icon: Compass,
      isActive: pathname.startsWith("/explore") || (pathname.startsWith("/jobs") && !pathname.includes("/apply")),
    },
    {
      label: "Saved",
      href: "/saved",
      icon: Bookmark,
      badge: savedCount,
      badgeLabel: "saved jobs",
      isActive: pathname.startsWith("/saved"),
    },
    {
      label: "Applied",
      href: "/applications",
      icon: ClipboardCheck,
      badge: appliedCount,
      badgeLabel: "submitted applications",
      isActive: pathname.startsWith("/applications") || pathname.includes("/apply"),
    },
    {
      label: "Profile",
      href: "/profile",
      icon: User,
      isActive: pathname.startsWith("/profile"),
    },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#ECEAE3] w-full ${
        fluid ? "max-w-4xl" : "max-w-[420px]"
      } mx-auto shadow-sm`}
    >
      <div className="flex items-center justify-around h-16 px-2 safe-area-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] min-w-[44px] rounded-lg transition-colors relative ${
                active ? "text-[#285C45]" : "text-[#77786F] hover:text-[#242720]"
              }`}
            >
              <div className="relative">
                <Icon
                  aria-hidden="true"
                  className={`w-5 h-5 transition-transform ${
                    active ? "scale-105 stroke-[2.4px]" : "stroke-[1.8px]"
                  }`}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    aria-label={`${item.badge} ${item.badgeLabel || "items"}`}
                    className="absolute -top-1 -right-2 bg-[#285C45] text-white text-[10px] font-bold rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center shadow-xs"
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-1 tracking-tight select-none ${
                  active ? "font-bold text-[#285C45]" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
