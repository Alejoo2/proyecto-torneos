import Link from "next/link";
import { Button, buttonVariants } from "torneos/components/ui/button/button";
import { Badge } from "torneos/components/ui/badge";
import { TeamChip } from "torneos/components/ui/team-chip";
import { CountdownTimer } from "torneos/components/ui/countdown-timer";
import { ENROLLMENT_STATUS } from "torneos/domain/status-labels";
import { cn } from "torneos/lib/utils";

export interface CtaTeam {
  id: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
}

export interface CtaEnrollment {
  id: string;
  status: string;
  team: CtaTeam;
  availabilityNote?: string | null;
}

type CtaVariant = "ANON" | "NO_TEAM" | "READY" | "HOLDING" | "ENROLLED";

interface EnrollmentCtaProps {
  variant: CtaVariant;
  loginHref?: string; // ANON
  teams?: CtaTeam[]; // READY / HOLDING
  selectedTeamId?: string;
  onSelectTeam?: (teamId: string) => void;
  onHold?: () => void; // READY
  isHolding?: boolean;
  hold?: { expiresAt: number; serverTimestamp: number } | null; // HOLDING
  onExpire?: () => void;
  isEnrolling?: boolean;
  onConfirmEnrollment?: () => void; // HOLDING
  enrollments?: CtaEnrollment[]; // ENROLLED
  isReevaluating?: boolean;
  onReevaluate?: (enrollmentId: string) => void;
  className?: string;
}

function TeamSelect({
  teams, value, onChange,
}: { teams: CtaTeam[]; value?: string; onChange?: (id: string) => void }) {
  if (teams.length <= 1) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="min-h-[48px] w-full rounded-xl border border-cypher-4-2-2/20 bg-cypher-5-1-1 px-4 text-sm text-cypher-4 focus:border-cypher-2/60 focus:outline-none"
    >
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

/**
 * PANTALLA 2 — zona CTA. Estado C es INLINE (decisión D1: SalaCineModal retirada).
 * El select vive también en HOLDING: hold() no persiste teamId, la elección
 * de equipo ocurre al confirmar (TournamentSlotHold.teamId nullable).
 */
export function EnrollmentCta(props: EnrollmentCtaProps) {
  const { variant, className } = props;

  if (variant === "ANON") {
    return (
      <div className={cn("rounded-2xl bg-cypher-5-1 p-4", className)}>
        <p className="text-sm text-cypher-4-2">Inicia sesión para inscribir a tu equipo en este torneo.</p>
        <Link href={props.loginHref ?? "/login"} className={cn(buttonVariants({ size: "lg" }), "mt-3 w-full")}>
          Entrar para inscribir tu equipo
        </Link>
      </div>
    );
  }

  if (variant === "NO_TEAM") {
    // Mensaje honesto: getMyTeams no distingue capitanía (B-14) — no alegamos rol.
    return (
      <div className={cn("rounded-2xl border border-dashed border-cypher-4-2-2/30 p-4 text-center", className)}>
        <p className="text-sm text-cypher-4-2">Necesitas un equipo para inscribirte.</p>
        <p className="mt-1 text-xs text-cypher-4-2-2">Crea uno o únete desde la pestaña Equipo.</p>
      </div>
    );
  }

  if (variant === "READY") {
    const selected = props.teams?.find((t) => t.id === props.selectedTeamId) ?? props.teams?.[0];
    return (
      <div className={cn("space-y-3", className)}>
        <TeamSelect teams={props.teams ?? []} value={props.selectedTeamId} onChange={props.onSelectTeam} />
        {props.teams?.length === 1 && selected && (
          <p className="flex items-center gap-2 text-sm text-cypher-4-2">
            Inscribirás a <TeamChip team={selected} />
          </p>
        )}
        <Button size="lg" className="w-full" onClick={props.onHold} disabled={props.isHolding}>
          {props.isHolding ? "Reservando cupo…" : "Reservar cupo"}
        </Button>
        <p className="text-center text-xs text-cypher-4-2-2">Reservarás un cupo por 5 minutos</p>
      </div>
    );
  }

  if (variant === "HOLDING" && props.hold) {
    const selected = props.teams?.find((t) => t.id === props.selectedTeamId) ?? props.teams?.[0];
    return (
      <div className={cn("rounded-2xl border border-cypher-2/30 bg-cypher-5-1 p-4", className)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cypher-4-2">Cupo reservado</p>
            <p className="mt-0.5 text-xs text-cypher-4-2-2">Confirma antes de que expire</p>
          </div>
          <CountdownTimer
            expiresAt={props.hold.expiresAt}
            serverTimestamp={props.hold.serverTimestamp}
            onExpire={props.onExpire}
            className="text-xl"
          />
        </div>
        <div className="mt-3 space-y-3">
          <TeamSelect teams={props.teams ?? []} value={props.selectedTeamId} onChange={props.onSelectTeam} />
          {props.teams?.length === 1 && selected && (
            <p className="flex items-center gap-2 text-sm text-cypher-4-2">
              Inscribirás a <TeamChip team={selected} />
            </p>
          )}
          <Button size="lg" className="w-full" onClick={props.onConfirmEnrollment} disabled={props.isEnrolling}>
            {props.isEnrolling ? "Confirmando…" : "Confirmar inscripción"}
          </Button>
          <p className="text-center text-xs text-cypher-4-2-2">
            El cupo se libera automáticamente al expirar
          </p>
        </div>
      </div>
    );
  }

  if (variant === "ENROLLED") {
    const list = props.enrollments ?? [];
    return (
      <div className={className}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cypher-4-2-2">
          {list.length > 1 ? "Mis inscripciones" : "Mi inscripción"}
        </p>
        <div className="space-y-2">
          {list.map((e) => {
            const meta = ENROLLMENT_STATUS[e.status as keyof typeof ENROLLMENT_STATUS];
            const pendingAvail = e.status === "PENDING_AVAILABILITY";
            return (
              <div key={e.id} className="rounded-2xl bg-cypher-5-1 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <TeamChip team={e.team} className="min-w-0" />
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={meta?.variant ?? "neutral"} status={meta?.label ?? e.status} />
                    {pendingAvail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => props.onReevaluate?.(e.id)}
                        disabled={props.isReevaluating}
                      >
                        Reevaluar
                      </Button>
                    )}
                  </div>
                </div>
                {pendingAvail && e.availabilityNote && (
                  <p className="mt-2 text-xs text-red-400">{e.availabilityNote}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}