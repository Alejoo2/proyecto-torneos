"use client";

import { Button } from "torneos/components/ui/button/button";
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
      secondaryColor: formData.get("secondaryColor") as string || undefined,
      description: formData.get("description") as string || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md mx-auto p-6 bg-white rounded-2xl shadow-md border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900">Crear Equipo</h2>
      
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-gray-700">Nombre del Equipo</label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={50}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          placeholder="Ej: Los Invencibles del Barrio"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="abbreviation" className="text-sm font-medium text-gray-700">Abreviatura (Tag)</label>
        <input
          id="abbreviation"
          name="abbreviation"
          required
          minLength={2}
          maxLength={10}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none uppercase"
          placeholder="Ej: LIB"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="primaryColor" className="text-sm font-medium text-gray-700">Color Principal</label>
          <input
            id="primaryColor"
            name="primaryColor"
            type="color"
            required
            defaultValue="#000000"
            className="h-12 w-full border border-gray-200 rounded-xl cursor-pointer p-1"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="secondaryColor" className="text-sm font-medium text-gray-700">Color Secundario</label>
          <input
            id="secondaryColor"
            name="secondaryColor"
            type="color"
            className="h-12 w-full border border-gray-200 rounded-xl cursor-pointer p-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-gray-700">Descripción (Opcional)</label>
        <textarea
          id="description"
          name="description"
          maxLength={500}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none resize-none"
          placeholder="Historia del equipo, barriada, lema..."
          rows={3}
        />
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded-lg">{error.message}</p>}

      <Button type="submit" disabled={isLoading} className="w-full mt-2">
        {isLoading ? "Creando Borrador..." : "Iniciar Creación (Draft)"}
      </Button>
    </form>
  );
}