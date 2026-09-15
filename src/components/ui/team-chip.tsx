import { cn } from "torneos/lib/utils";

interface TeamChipProps {
  team: { name: string; abbreviation: string; primaryColor: string };
  className?: string;
}

export function TeamChip({ team, className }: TeamChipProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-cypher-4", className)}>
      {/* Excepción documentada a 3.2: color DINÁMICO desde BD. El estilo vive en
          clases; el dato entra como CSS var. No es "diseño inline". */}
      <span
        className="flex size-5 items-center justify-center rounded-full bg-(--team-color) text-[9px] font-bold text-cypher-5"
        style={{ "--team-color": team.primaryColor } as React.CSSProperties}
      >
        {team.abbreviation}
      </span>
      {team.name}
    </span>
  );
}