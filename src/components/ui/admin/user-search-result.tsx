// user-search-result.tsx
interface UserSearchResultProps {
  name: string;
  email: string;
  onSelect: () => void;
}

/** W10 re-skin (contrato intacto). */
export function UserSearchResult({ name, email, onSelect }: UserSearchResultProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl border border-cypher-5-1-1 bg-cypher-5 p-3 text-left transition-colors active:bg-cypher-5-1-1"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cypher-5-1-1">
        <span className="font-medium text-cypher-4-2">{name.charAt(0)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-cypher-4">{name}</p>
        <p className="truncate text-xs text-cypher-4-2-2">{email}</p>
      </div>
      <span className="shrink-0 rounded-md bg-cypher-5-1-1 px-2 py-1 text-xs font-medium text-cypher-4">
        Seleccionar
      </span>
    </button>
  );
}