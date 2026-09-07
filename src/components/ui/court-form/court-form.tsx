"use client";

import { useState } from "react";
import { Button } from "torneos/components/ui/button/button";

interface CourtFormProps {
  onSubmit: (data: {
    name: string;
    address: string;
    description?: string;
    inventory?: string;
  }) => void;
  isLoading?: boolean;
}

export function CourtForm({ onSubmit, isLoading }: CourtFormProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [inventory, setInventory] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, address, description, inventory });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Nombre de la Cancha
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          placeholder="Ej: Cancha El Campín"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Dirección
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          placeholder="Ej: Calle 123 #45-67, Barrio Central"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Descripción
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          rows={3}
          placeholder="Cancha de césped sintético con iluminación nocturna..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Inventario (Implementos)
        </label>
        <input
          type="text"
          value={inventory}
          onChange={(e) => setInventory(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          placeholder="Arcos, redes, 4 pelotas, vestuarios"
        />
      </div>

      <Button type="submit" isLoading={isLoading} className="w-full">
        Crear Cancha y Generar Disponibilidad
      </Button>
    </form>
  );
}