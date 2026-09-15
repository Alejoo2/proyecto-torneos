"use client";

import { Bell } from "lucide-react";
interface NotificationBellProps {
  count?: number;
  onClick?: () => void;
}

export function NotificationBell({ count = 0, onClick }: NotificationBellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `${count} notificaciones sin leer` : "Notificaciones"}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-cypher-4 transition-colors active:bg-cypher-5-1-1"
    >
      <Bell className="size-5" />
      {count > 0 && (
        // Badge: semántico estándar (3.4 + 4.5). Jamás un acento Cypher.
        <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[9px] font-bold leading-4 text-cypher-5">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}