import { Button } from "torneos/components/ui/button/button";

interface InvitationCardProps {
  teamName: string;
  teamPrimaryColor: string; // Hex color, ej: "#FF5733"
  inviterName: string;
  onAccept: () => void;
  onReject: () => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

export function InvitationCard({
  teamName,
  teamPrimaryColor,
  inviterName,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: InvitationCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-cypher-5-1-1/60 bg-cypher-5-1 p-4">
      {/* Encabezado: Color del equipo y Nombre */}
      <div className="flex items-center gap-3">
        {/* Workaround de Sistema 3 para color dinámico sin CSS inline */}
        <svg className="h-10 w-2 rounded-full" viewBox="0 0 10 40" aria-hidden="true">
          <rect width="10" height="40" rx="5" fill={teamPrimaryColor} />
        </svg>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-cypher-4">{teamName}</h3>
          <p className="truncate text-xs text-cypher-4-2-2">
            Invitación de <span className="font-medium text-cypher-4-2">{inviterName}</span>
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <Button
          onClick={onReject}
          disabled={isRejecting || isAccepting}
          variant="outline"
          className="flex-1 rounded-xl text-sm font-medium min-h-[48px]"
        >
          {isRejecting ? "Rechazando..." : "Rechazar"}
        </Button>
        <Button
          onClick={onAccept}
          disabled={isAccepting || isRejecting}
          className="flex-1 rounded-xl text-sm font-medium min-h-[48px]"
        >
          {isAccepting ? "Aceptando..." : "Aceptar"}
        </Button>
      </div>
    </div>
  );
}