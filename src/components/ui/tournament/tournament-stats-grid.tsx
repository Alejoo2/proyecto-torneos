interface TournamentStatsGridProps {
  enrolledCount: number;
  maxTeams: number;
  dayOfWeek: string;
  timeSlot: string;
  enrollmentDeadline: string;
  format: string;
}

export function TournamentStatsGrid({ 
  enrolledCount, maxTeams, dayOfWeek, timeSlot, enrollmentDeadline, format 
}: TournamentStatsGridProps) {
  const progress = (enrolledCount / maxTeams) * 100;
  
  return (
    <div className="grid grid-cols-2 gap-3 mb-6 px-6">
      <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-100">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-xl font-bold text-zinc-900">{enrolledCount}</span>
          <span className="text-sm text-zinc-400">/{maxTeams}</span>
        </div>
        <div className="text-xs text-zinc-500 font-medium">Equipos inscritos</div>
        <div className="mt-2 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
      
      <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-100">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm font-semibold text-zinc-900">{dayOfWeek}</span>
        </div>
        <div className="text-xs text-zinc-500 font-medium">{timeSlot}</div>
      </div>

      <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-100">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm font-semibold text-zinc-900">{enrollmentDeadline}</span>
        </div>
        <div className="text-xs text-zinc-500 font-medium">Cierra inscripción</div>
      </div>

      <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-100">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm font-semibold text-zinc-900">{format}</span>
        </div>
        <div className="text-xs text-zinc-500 font-medium">Formato</div>
      </div>
    </div>
  );
}