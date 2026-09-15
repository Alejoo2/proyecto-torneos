import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Badge } from "torneos/components/ui/badge";
import { Button } from "torneos/components/ui/button/button";
import { TeamChip } from "torneos/components/ui/team-chip";
import { ENROLLMENT_STATUS, type EnrollmentStatus } from "torneos/domain/status-labels";
import { cn } from "torneos/lib/utils";

// Fila de inscripción — PURO (sin tRPC): mutaciones y optimistic viven en el
// template. Acciones = mapeo exacto de transiciones del enrollment.engine:
// PENDING_PAYMENT → aprobar/reject · PENDING_AVAILABILITY → reject ·
// APPROVED → disapprove (dos toques) · terminales → sin acciones.
const MIN_REASON = 10; // espejo del zod del router (reject: min 10)

interface EnrollmentRowProps {
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    availabilityNote: string | null;
    disapprovedReason: string | null;
    team: { id: string; name: string; abbreviation: string; primaryColor: string };
  };
  isBusy: boolean;
  onApprove: (enrollmentId: string) => void;
  onReject: (enrollmentId: string, reason: string) => void;
  onDisapprove: (enrollmentId: string) => void;
}

export function EnrollmentRow({ enrollment, isBusy, onApprove, onReject, onDisapprove }: EnrollmentRowProps) {
  const { status } = enrollment;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmingDisapprove, setConfirmingDisapprove] = useState(false);

  // Éxito del optimistic = flip de status en props → limpia la expansión.
  // Rollback (status vuelve) NO dispara reset → el motivo queda editable para reintentar.
  useEffect(() => {
    if (status === "REJECTED") {
      setRejecting(false);
      setReason("");
    }
  }, [status]);

  useEffect(() => {
    if (status !== "APPROVED") setConfirmingDisapprove(false);
  }, [status]);

  // Doble confirmación con auto-reset
  useEffect(() => {
    if (!confirmingDisapprove) return;
    const t = setTimeout(() => setConfirmingDisapprove(false), 3000);
    return () => clearTimeout(t);
  }, [confirmingDisapprove]);

  const label = ENROLLMENT_STATUS[status];
  const isTerminal = status === "REJECTED" || status === "DISAPPROVED";
  const reasonTooShort = reason.trim().length < MIN_REASON;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
      className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <TeamChip team={enrollment.team} className="min-w-0" />
        <Badge variant={label.variant} status={label.label} />
      </div>

      {/* El dato informa, la piel no (nota semántica = texto, no color de contenedor) */}
      {status === "PENDING_AVAILABILITY" && enrollment.availabilityNote && (
        <p className="mt-2 text-xs text-yellow-400/90">{enrollment.availabilityNote}</p>
      )}
      {status === "PENDING_PAYMENT" && (
        <p className="mt-2 text-xs text-cypher-4-2">Verificar pago para confirmar el cupo del equipo.</p>
      )}
      {isTerminal && enrollment.disapprovedReason && (
        <p className="mt-2 text-xs text-cypher-4-2">Motivo: {enrollment.disapprovedReason}</p>
      )}

      {/* Rechazo con motivo — expansión inline, sin modal */}
      {rejecting && !isTerminal && (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder={`Motivo para el capitán (mín. ${MIN_REASON} caracteres)`}
            className="w-full resize-none rounded-xl border border-cypher-4-2-2/40 bg-cypher-5-1-1 px-3 py-2 text-sm text-cypher-4 placeholder:text-cypher-4-2 focus:outline-none focus:ring-2 focus:ring-cypher-2/60"
          />
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-xs", reasonTooShort ? "text-yellow-400/90" : "text-cypher-4-2")}>
              {reason.trim().length}/{MIN_REASON}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={isBusy}
                onClick={() => {
                  setRejecting(false);
                  setReason("");
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={reasonTooShort || isBusy}
                onClick={() => onReject(enrollment.id, reason.trim())}
              >
                Confirmar rechazo
              </Button>
            </div>
          </div>
        </div>
      )}

      {!rejecting && !isTerminal && (
        <div className="mt-3 flex justify-end gap-2">
          {status === "PENDING_PAYMENT" && (
            <>
              <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setRejecting(true)}>
                Rechazar
              </Button>
              <Button size="sm" disabled={isBusy} onClick={() => onApprove(enrollment.id)}>
                Aprobar pago
              </Button>
            </>
          )}
          {status === "PENDING_AVAILABILITY" && (
            <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setRejecting(true)}>
              Rechazar
            </Button>
          )}
          {status === "APPROVED" &&
            (confirmingDisapprove ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={isBusy}
                onClick={() => {
                  setConfirmingDisapprove(false);
                  onDisapprove(enrollment.id);
                }}
              >
                ¿Confirmar?
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400"
                disabled={isBusy}
                onClick={() => setConfirmingDisapprove(true)}
              >
                Desaprobar
              </Button>
            ))}
        </div>
      )}
    </motion.article>
  );
}