import { cn } from "torneos/lib/utils";

interface TabBarProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function TabBar({ tabs, active, onChange, className }: TabBarProps) {
  return (
    <div role="tablist" className={cn("flex gap-1 rounded-2xl bg-cypher-5-1 p-1", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "min-h-[44px] flex-1 rounded-xl px-4 text-sm font-semibold transition-colors",
              isActive
                ? "bg-cypher-2 text-cypher-5"
                : "text-cypher-4-2 hover:bg-cypher-4/5 hover:text-cypher-4",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}