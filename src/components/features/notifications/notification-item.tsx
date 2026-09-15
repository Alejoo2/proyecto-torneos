"use client";

import { CalendarDays, Megaphone, Shield, Trophy, Users } from "lucide-react";
import { cn } from "torneos/lib/utils";
import { Age } from "torneos/components/ui/age";

// PLACEHOLDER: unión tentativa. Alinear con el enum real de familias S11 al integrar.
const FAMILY_ICON = {
  TOURNAMENT: Trophy,
  ENROLLMENT: Shield,
  MATCH: CalendarDays,
  TEAM: Users,
  SYSTEM: Megaphone,
} as const;

export interface NotificationData {
  id: string;
  family: keyof typeof FAMILY_ICON;
  title: string;
  body: string;
  createdAt: number; // epoch ms
  read: boolean;
}

interface NotificationItemProps {
  notification: NotificationData;
  onRead?: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const Icon = FAMILY_ICON[notification.family];

  return (
    <button
      type="button"
      onClick={() => onRead?.(notification.id)}
      className={cn(
        "flex w-full items-start gap-3 border-b border-cypher-5-1 px-4 py-3 text-left transition-colors active:bg-cypher-5-1-1",
        !notification.read && "bg-cypher-5-1",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", notification.read ? "text-cypher-4-2-2" : "text-cypher-4")} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", notification.read ? "text-cypher-4-2" : "font-semibold text-cypher-4")}>
            {notification.title}
          </span>
          <Age dataUpdatedAt={notification.createdAt} className="shrink-0 text-[10px] text-cypher-4-2-2" />
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-cypher-4-2-2">{notification.body}</span>
      </span>
      {!notification.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-green-500" />}
    </button>
  );
}