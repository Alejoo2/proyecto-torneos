interface UserSearchResultProps {
  name: string;
  email: string;
  onSelect: () => void;
}

export function UserSearchResult({ name, email, onSelect }: UserSearchResultProps) {
  return (
    <button 
      className="w-full bg-white rounded-xl p-3 flex items-center gap-3 hover:bg-zinc-50 active:bg-zinc-100 transition-colors text-left border border-zinc-100"
      onClick={onSelect}
    >
      <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center shrink-0">
        <span className="text-zinc-500 font-medium">{name.charAt(0)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-900 text-sm truncate">{name}</p>
        <p className="text-xs text-zinc-500 truncate">{email}</p>
      </div>
      <span className="text-zinc-900 text-xs font-medium bg-zinc-100 px-2 py-1 rounded-md">Hacer Gestor</span>
    </button>
  );
}