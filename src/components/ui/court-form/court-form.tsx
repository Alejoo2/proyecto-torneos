"use client";

import { useState } from "react";
import { Button } from "torneos/components/ui/button/button";

// W5 — Re-skin del form de creación de cancha (piel blanca → Cypher).
// Contrato INTACTO: { onSubmit, isLoading? } con la misma forma de datos.
// Espejo del zod de court.create: name.min(2) · address.min(5) → deshabilitan el submit.
// court.create además rechaza nombre duplicado (CONFLICT, insensible): ese error
// lo muestra el template en línea — el front no pre-valida unicidad.

const INPUT_CLS =
  "w-full rounded-xl border border-cypher-4/15 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 placeholder:text-cypher-4-2-2 focus:border-cypher-2/60 focus:outline-none";
const LABEL_CLS = "mb-1 block text-xs font-medium text-cypher-4-2";

interface CourtFormProps {
  onSubmit: (data: {
    name: string;
    address: string;
    description?: string;
    inventory?: string;
  }) => void;
  isLoading?: boolean;
  /** W10 (ADITIVO): modo edición — monta los campos con valores de la cancha. */
  initialValues?: { name?: string; address?: string; description?: string; inventory?: string };
  /** W10 (ADITIVO): etiqueta del submit ("Crear cancha y generar disponibilidad" por defecto). */
  submitLabel?: string;
}

export function CourtForm({ onSubmit, isLoading, initialValues, submitLabel }: CourtFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [address, setAddress] = useState(initialValues?.address ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [inventory, setInventory] = useState(initialValues?.inventory ?? "");

  // Espejo zod: name.min(2) · address.min(5)
  const isFormValid = name.trim().length >= 2 && address.trim().length >= 5;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    onSubmit({
      name: name.trim(),
      address: address.trim(),
      description: description.trim() || undefined,
      inventory: inventory.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="court-name" className={LABEL_CLS}>
          Nombre de la cancha
        </label>
        <input
          id="court-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className={INPUT_CLS}
          placeholder="Ej: Cancha El Campín"
        />
      </div>

      <div>
        <label htmlFor="court-address" className={LABEL_CLS}>
          Dirección
        </label>
        <input
          id="court-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          maxLength={300}
          className={INPUT_CLS}
          placeholder="Ej: Calle 123 #45-67, Barrio Central"
        />
      </div>

      <div>
        <label htmlFor="court-description" className={LABEL_CLS}>
          Descripción
        </label>
        <textarea
          id="court-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          className={INPUT_CLS}
          placeholder="Cancha de césped sintético con iluminación nocturna..."
        />
      </div>

      <div>
        <label htmlFor="court-inventory" className={LABEL_CLS}>
          Inventario (implementos)
        </label>
        <input
          id="court-inventory"
          type="text"
          value={inventory}
          onChange={(e) => setInventory(e.target.value)}
          maxLength={1000}
          className={INPUT_CLS}
          placeholder="Arcos, redes, 4 pelotas, vestuarios"
        />
      </div>

      <Button type="submit" isLoading={isLoading} disabled={!isFormValid} className="w-full">
        {submitLabel ?? "Crear cancha y generar disponibilidad"}
      </Button>
    </form>
  );
}