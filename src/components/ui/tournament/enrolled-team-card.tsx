import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";

const teamBadgeVariants = cva("px-2 py-0.5 rounded-full text-[10px] font-semibold", {
  variants: {
    status: {
      APPROVED: "bg-green-100 text-green-700",
      PENDING_PAYMENT: "bg-orange-100 text-orange-700",
      PENDING_AVAILABILITY: "bg-red-100 text-red-700",
    },
  },
});

interface EnrolledTeamCardProps {
  teamId: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  status: "APPROVED" | "PENDING_PAYMENT" | "PENDING_AVAILABILITY";
  availabilityNote?: string | null;
}

export function EnrolledTeamCard({ 
  teamId, name, abbreviation, primaryColor, status, availabilityNote 
}: EnrolledTeamCardProps) {
  return (
    <Link href={`/equipos/${teamId}`} className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm hover:shadow-md active:shadow-sm transition-all block">
      <div className="flex items-center justify-between mb-2">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm" 
          style={{ backgroundColor: primaryColor }}
        >
          {abbreviation.slice(0, 3)}
        </div>
        <span className={teamBadgeVariants({ status })}>
          {status === "APPROVED" && "✓ APROBADO"}
          {status === "PENDING_PAYMENT" && "⏳ PAGO"}
          {status === "PENDING_AVAILABILITY" && "⚠ CONFLICTO"}
        </span>
      </div>
      <div className="text-sm font-semibold text-zinc-900 truncate">{name}</div>
      {availabilityNote && status === "PENDING_AVAILABILITY" && (
        <div className="text-xs text-red-500 mt-1 truncate" title={availabilityNote || ""}>
          {availabilityNote}
        </div>
      )}
    </Link>
  );
}