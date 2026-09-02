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
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
      {/* Encabezado: Color del equipo y Nombre */}
      <div className="flex items-center gap-3">
        {/* Workaround de Sistema 3 para color dinámico sin CSS inline */}
        <svg className="w-2 h-10 rounded-full" viewBox="0 0 10 40" aria-hidden="true">
          <rect width="10" height="40" rx="5" fill={teamPrimaryColor} />
        </svg>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 truncate">{teamName}</h3>
          <p className="text-xs text-gray-500 truncate">
            Invitación de <span className="font-medium text-gray-700">{inviterName}</span>
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <Button
          onClick={onReject}
          disabled={isRejecting || isAccepting}
          variant="outline"
          className="flex-1 min-h-48px rounded-xl text-sm font-medium"
        >
          {isRejecting ? "Rechazando..." : "Rechazar"}
        </Button>
        <Button
          onClick={onAccept}
          disabled={isAccepting || isRejecting}
          className="flex-1 min-h-48px rounded-xl text-sm font-medium"
        >
          {isAccepting ? "Aceptando..." : "Aceptar"}
        </Button>
      </div>
    </div>
  );
}