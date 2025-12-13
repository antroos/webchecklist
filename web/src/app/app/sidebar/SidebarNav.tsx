"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "Workspace" },
  { href: "/app/billing", label: "Billing" },
  { href: "/app/account", label: "Account" },
] as const;

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "block rounded-xl px-3 py-2 text-sm font-medium transition",
              active
                ? "border border-[color:rgba(97,106,243,0.24)] bg-[color:rgba(97,106,243,0.10)] text-[color:rgba(11,18,32,0.92)]"
                : "text-[color:rgba(11,18,32,0.74)] hover:bg-[color:rgba(15,23,42,0.04)]",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}


