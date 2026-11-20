"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Library } from "lucide-react";
import { cn } from "../ui";

export function AdminNav() {
  const path = usePathname();
  const tabs = [
    { href: "/admin", label: "Categories", icon: LayoutGrid, active: path === "/admin" || path.startsWith("/admin/categories") },
    { href: "/admin/fields", label: "Field library", icon: Library, active: path.startsWith("/admin/fields") },
  ];
  return (
    <nav className="flex rounded-full border border-line-2 bg-surface p-1">
      {tabs.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn("flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm", active ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
