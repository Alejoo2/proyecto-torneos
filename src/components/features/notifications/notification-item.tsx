"use client";

import type { NotificationFamily } from "@prisma/client";
import { CalendarDays, Megaphone, Shield, Trophy, Users, Bell } from "lucide-react";
import { cn } from "torneos/lib/utils";
import { Age } from "torneos/components/ui/age";

const FAMILY_ICON: Record<NotificationFamily, typeof Bell> = {
  TOURNAMENT: Trophy,
  TEAM: Users,
  RECRUITMENT: Shield,
  MATCH: CalendarDays,
  COURT: CalendarDays,
  AUTH: Bell,
  SYSTEM: Megaphone,
};

export interface NotificationItemData {
  id: string;
  family: NotificationFamily;
  title: string;
  body: string;
  createdAt: Date | string | number;
  status: "UNREAD" | "READ";
}

/** Exportación retrocompatible para fixtures de diseño/demo */
export type NotificationData = {
  id: string;
  family: NotificationFamily;
  title: string;
  body: string;
  createdAt: Date | string | number;
  read?: boolean;
  status?: "UNREAD" | "READ";
};

interface NotificationItemProps {
  notification: NotificationItemData;
  onRead?: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const Icon = FAMILY_ICON[notification.family] ?? Bell;
  const isRead = notification.status === "READ";

  return (
    <button
      type="button"
      onClick={() => onRead?.(notification.id)}
      className={cn(
        "flex w-full items-start gap-3 border-b border-cypher-5-1 px-4 py-3 text-left transition-colors active:bg-cypher-5-1-1",
        !isRead && "bg-cypher-5-1",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", isRead ? "text-cypher-4-2-2" : "text-cypher-4")} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", isRead ? "text-cypher-4-2" : "font-semibold text-cypher-4")}>
            {notification.title}
          </span>
          <Age dataUpdatedAt={new Date(notification.createdAt).getTime()} className="shrink-0 text-[10px] text-cypher-4-2-2" />
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-cypher-4-2-2">{notification.body}</span>
      </span>
      {!isRead && <span className="mt-2 size-2 shrink-0 rounded-full bg-green-500" />}
    </button>
  );
}