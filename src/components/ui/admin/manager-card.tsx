import { cn } from "torneos/lib/utils";

interface ManagerCardProps {
  name: string;
  email: string;
  isActive: boolean;
  onToggleStatus: () => void;
}

export function ManagerCard({ name, email, isActive, onToggleStatus }: ManagerCardProps) {
  return (
    <div className="bg-white border-2 border-zinc-200 rounded-2xl p-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 font-bold shrink-0">
          {name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 truncate">{name}</p>
          <p className="text-xs text-zinc-500 truncate">{email}</p>
        </div>
        <button 
          className={cn(
            "w-14 h-8 rounded-full relative transition-colors shrink-0",
            isActive ? "bg-zinc-900" : "bg-zinc-300"
          )}
          onClick={onToggleStatus}
          aria-label="Toggle activo"
        >
          <span className={cn(
            "absolute top-1 w-6 h-6 bg-white rounded-full transition-transform",
            isActive ? "right-1" : "left-1"
          )} />
        </button>
      </div>
    </div>
  );
}