"use client";

import { useState } from "react";
import { AvailabilityMatrix } from "torneos/components/ui/availability-matrix/availability-matrix";
import { useOnboarding, useAvailabilityMatrix } from "torneos/components/features/onboarding/use-onboarding";

export default function OnboardingPage() {
  const { completeOnboarding, isSubmitting } = useOnboarding();
  const { availabilities, toggleSlot } = useAvailabilityMatrix();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await completeOnboarding({ displayName, phone: phone || undefined, bio: bio || undefined });
  };

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-8 min-h-screen bg-zinc-950 text-white">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black uppercase tracking-tight">Configura tu Perfil</h1>
        <p className="text-zinc-400 text-sm">Cuenta a la comunidad quién eres y cuándo juegas.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-bold uppercase border-b border-zinc-800 pb-2 mb-2">1. Datos básicos</h2>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-zinc-400">Nombre de Jugador *</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-zinc-800 rounded-md p-2 text-white outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Ej: El Bicho FC"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-zinc-400">Teléfono (Opcional)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="bg-zinc-800 rounded-md p-2 text-white outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="+57 300 000 0000"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-zinc-400">Bio (Opcional)</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="bg-zinc-800 rounded-md p-2 text-white outline-none focus:ring-2 focus:ring-emerald-500 h-20 resize-none"
            placeholder="Cuéntale a la cancha tu estilo de juego..."
          />
        </div>
      </form>

      <div className="flex flex-col gap-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-bold uppercase border-b border-zinc-800 pb-2 mb-2">2. Disponibilidad Horaria</h2>
        <p className="text-zinc-400 text-xs">
          Toca las casillas para activar/desactivar. Verde: Disponible. Gris: No disponible. 
          (Amarillo significará que tienes partido en ese horario).
        </p>
        
        <AvailabilityMatrix slots={availabilities} onToggleSlot={toggleSlot} />
      </div>

      <button
        type="submit"
        onClick={handleSubmit}
        disabled={isSubmitting ?? !displayName}
        className="mt-4 w-full bg-emerald-500 text-zinc-950 font-black uppercase p-3 rounded-md hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Guardando..." : "Ir a la Cancha"}
      </button>
    </main>
  );
}