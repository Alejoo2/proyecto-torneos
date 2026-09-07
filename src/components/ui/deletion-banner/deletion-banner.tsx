"use client";

interface DeletionBannerProps {
  votes: number;
  totalMembers: number;
  hasVoted: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function DeletionBanner({
  votes,
  totalMembers,
  hasVoted,
  onApprove,
  onReject
}: DeletionBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 m-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-red-800">Votación de Eliminación</h3>
          <p className="text-xs text-red-600 mt-0.5">
            El capitán ha solicitado eliminar este equipo. Votos: {votes}/{totalMembers}.
            Se requiere la aprobación de todos los miembros para eliminarlo.
          </p>
          
          <div className="mt-3 w-full bg-red-200 rounded-full h-1.5">
            <div 
              className="bg-red-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${(votes / totalMembers) * 100}%` }} // Excepción: estilo dinámico de progreso
            />
          </div>

          {!hasVoted ? (
            <div className="flex gap-2 mt-3">
              <button 
                onClick={onApprove}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-xs font-bold uppercase hover:bg-red-600 transition-colors active:scale-95"
              >
                Aprobar Eliminación
              </button>
              <button 
                onClick={onReject}
                className="flex-1 bg-white text-red-500 border border-red-300 py-2 rounded-lg text-xs font-bold uppercase hover:bg-red-50 transition-colors active:scale-95"
              >
                Rechazar
              </button>
            </div>
          ) : (
            <p className="text-xs text-red-500 font-medium mt-3 italic">Tu voto ha sido registrado. Esperando al resto del equipo...</p>
          )}
        </div>
      </div>
    </div>
  );
}