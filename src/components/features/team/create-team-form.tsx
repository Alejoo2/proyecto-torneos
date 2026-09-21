"use client";

import { useCreateDraft } from "torneos/components/features/team/use-team";

export function CreateTeamForm() {
  const { mutate: createDraft, isPending: isLoading, error } = useCreateDraft();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createDraft({
      name: formData.get("name") as string,
      abbreviation: formData.get("abbreviation") as string,
      primaryColor: formData.get("primaryColor") as string,
      secondaryColor: (formData.get("secondaryColor") as string) || undefined,
      description: (formData.get("description") as string) || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="team-name" className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
          Nombre del equipo
        </label>
        <input
          id="team-name"
          name="name"
          required
          minLength={2}
          maxLength={50}
          className="rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
          placeholder="Ej: Los Invencibles del Barrio"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="team-abbreviation" className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
          Abreviatura (Tag)
        </label>
        <input
          id="team-abbreviation"
          name="abbreviation"
          required
          minLength={2}
          maxLength={10}
          className="rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm uppercase text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
          placeholder="Ej: LIB"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="team-primary-color" className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
            Color principal
          </label>
          <input
            id="team-primary-color"
            name="primaryColor"
            type="color"
            required
            defaultValue="#7B2CBF"
            className="h-11 w-full cursor-pointer rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 p-1"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="team-secondary-color" className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
            Color secundario
          </label>
          <input
            id="team-secondary-color"
            name="secondaryColor"
            type="color"
            className="h-11 w-full cursor-pointer rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 p-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="team-description" className="text-xs font-semibold uppercase tracking-wide text-cypher-4-2">
          Descripción (opcional)
        </label>
        <textarea
          id="team-description"
          name="description"
          maxLength={500}
          rows={3}
          className="resize-none rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
          placeholder="Historia del equipo, barriada, lema..."
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
          {error.message}
        </p>
      )}

      {/* Espejo del zod en atributos HTML; CONFLICT/FORBIDDEN del server llegan como error arriba */}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-1 w-full rounded-xl bg-cypher-2 py-3 text-sm font-bold text-cypher-5 transition-colors active:bg-cypher-2-1 disabled:opacity-50"
      >
        {isLoading ? "Creando borrador..." : "Crear equipo"}
      </button>
    </form>
  );
}