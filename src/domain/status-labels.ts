// Vocabulario cerrado = el del átomo ui/badge.tsx (matriz 4.3 + semánticos 4.5).
// success/warning/error = familias estándar de Tailwind (deuda TECH-DEBT-COLOR-SEMANTICS).
// neutral = estados terminales o no activos (DRAFT, FINISHED, WALKOVER, INACTIVE).
export type BadgeVariant = "success" | "warning" | "error" | "neutral";

export interface StatusLabel {
  label: string;
  variant: BadgeVariant;
}

// Tipos literales = mismos valores que generan los enums de Prisma,
// sin importar @prisma/client en el bundle del cliente
export type TournamentStatus = "DRAFT" | "SCHEDULED" | "GRACE_PERIOD" | "IN_PROGRESS" | "FINISHED" | "CANCELLED" | "SUSPENDED";
export type EnrollmentStatus = "PENDING_AVAILABILITY" | "PENDING_PAYMENT" | "APPROVED" | "REJECTED" | "DISAPPROVED";
export type MatchStatus = "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED" | "WALKOVER";
export type TeamStatus = "DRAFT" | "ACTIVE" | "INACTIVE";
export type CourtStatus = "ENABLED" | "DISABLED";

export const TOURNAMENT_STATUS: Record<TournamentStatus, StatusLabel> = {
  DRAFT: { label: "Borrador", variant: "neutral" },
  SCHEDULED: { label: "Inscripciones abiertas", variant: "success" },
  GRACE_PERIOD: { label: "Período de gracia", variant: "warning" },
  IN_PROGRESS: { label: "En curso", variant: "neutral" },
  FINISHED: { label: "Finalizado", variant: "neutral" },
  CANCELLED: { label: "Cancelado", variant: "error" },
  SUSPENDED: { label: "Suspendido", variant: "warning" },
};

export const ENROLLMENT_STATUS: Record<EnrollmentStatus, StatusLabel> = {
  PENDING_AVAILABILITY: { label: "Disponibilidad pendiente", variant: "warning" },
  PENDING_PAYMENT: { label: "Pago pendiente", variant: "warning" },
  APPROVED: { label: "Aprobado", variant: "success" },
  REJECTED: { label: "Rechazado", variant: "error" },
  DISAPPROVED: { label: "Desaprobado", variant: "error" },
};

export const MATCH_STATUS: Record<MatchStatus, StatusLabel> = {
  SCHEDULED: { label: "Programado", variant: "neutral" },
  IN_PROGRESS: { label: "En juego", variant: "success" },
  FINISHED: { label: "Finalizado", variant: "neutral" },
  POSTPONED: { label: "Aplazado", variant: "warning" },
  CANCELLED: { label: "Cancelado", variant: "error" },
  WALKOVER: { label: "Walkover", variant: "neutral" },
};

export const TEAM_STATUS: Record<TeamStatus, StatusLabel> = {
  DRAFT: { label: "Borrador", variant: "neutral" },
  ACTIVE: { label: "Activo", variant: "success" },
  INACTIVE: { label: "Inactivo", variant: "neutral" },
};

export const COURT_STATUS: Record<CourtStatus, StatusLabel> = {
  ENABLED: { label: "Habilitada", variant: "success" },
  DISABLED: { label: "Deshabilitada", variant: "error" },
};
// ─── W5 (aditivo) — Dominio Cancha ───

export type StatusBadgeVariant = "success" | "warning" | "error" | "neutral";

export const TOURNAMENT_STATUS_LABEL: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  DRAFT:        { label: "Borrador",   variant: "neutral" },
  SCHEDULED:    { label: "Programado", variant: "neutral" },
  GRACE_PERIOD: { label: "En gracia",  variant: "warning" },
  IN_PROGRESS:  { label: "En curso",   variant: "success" },
  FINISHED:     { label: "Finalizado", variant: "neutral" },
};

export const COURT_STATUS_LABEL: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  ENABLED:  { label: "Habilitada",   variant: "success" },
  DISABLED: { label: "Deshabilitada", variant: "error" },
};