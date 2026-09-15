import { cn } from "torneos/lib/utils";

const SIZES = {
  sm: "size-7 text-[10px]",
  md: "size-10 text-xs",
  lg: "size-14 text-sm",
} as const;

interface PlayerAvatarProps {
  profile: { displayName: string; image?: string | null };
  size?: keyof typeof SIZES;
  className?: string;
}

export function PlayerAvatar({ profile, size = "md", className }: PlayerAvatarProps) {
  const initials = profile.displayName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-cypher-5-1-1 font-semibold text-cypher-4-2",
        SIZES[size],
        className,
      )}
    >
      {profile.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.image} alt={profile.displayName} className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}