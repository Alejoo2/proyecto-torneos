"use client";

interface DeletionBannerProps {
  votes: number;
  totalMembers: number;
  hasVoted: boolean;
  onApprove: () => void;
  onReject: () => void;
}

/** W8 re-skin (contrato intacto). Semánticos estándar para el peligro; progreso
 *  con width dinámico (excepción CSS var dinámico, precedente W4). */
export function DeletionBanner({
  votes,
  totalMembers,
  hasVoted,
  onApprove,
  onReject,
}: DeletionBannerProps) {
  return (
    <div className="mx-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
      <h3 className="text-sm font-bold text-red-400">Votación de eliminación</h3>
      <p className="mt-0.5 text-xs text-red-400/80">
        El capitán ha solicitado eliminar este equipo. Votos: {votes}/{totalMembers}.
        Se requiere la aprobación de todos los miembros.
      </p>

      <div className="mt-3 h-1.5 w-full rounded-full bg-red-500/20">
        <div
          className="h-1.5 rounded-full bg-red-500 transition-all duration-500"
          style={{ width: `${totalMembers > 0 ? (votes / totalMembers) * 100 : 0}%` }}
        />
      </div>

      {!hasVoted ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 rounded-lg bg-red-500 py-2 text-xs font-bold uppercase text-white transition-colors active:scale-95 active:bg-red-600"
          >
            Aprobar eliminación
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex-1 rounded-lg border border-red-500/30 bg-transparent py-2 text-xs font-bold uppercase text-red-400 transition-colors active:scale-95 active:bg-red-500/10"
          >
            Rechazar
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium italic text-red-400/80">
          Tu voto fue registrado. Esperando al resto del equipo...
        </p>
      )}
    </div>
  );
}