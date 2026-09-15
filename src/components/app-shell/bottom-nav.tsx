"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Shield, Trophy, User } from "lucide-react";
import { cn } from "torneos/lib/utils";

const TABS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/equipos", label: "Equipo", icon: Shield },
  { href: "/torneos", label: "Torneos", icon: Trophy },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;

interface BottomNavProps {
  /** Solo demos (/design). En producción NUNCA se pasa: manda usePathname (3.1). */
  activeTab?: string;
}

export function BottomNav({ activeTab }: BottomNavProps) {
  const pathname = usePathname();
  const current = activeTab ?? pathname;

  return (
    // h-16 = 64px base (3.1) + safe-area como padding inferior (2.1)
    <nav className="z-nav flex h-16 shrink-0 items-stretch border-t border-cypher-5-1-1 bg-cypher-5-1 pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = current === href || (href !== "/" && current.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-11 flex-1 flex-col items-center justify-center gap-0.5 transition-colors active:bg-cypher-5-1-1",
              active ? "text-cypher-2" : "text-cypher-4-2",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}