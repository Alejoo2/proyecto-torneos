"use client";

import { useState } from "react";
import { AvailabilityMatrix } from "torneos/components/ui/availability-matrix/availability-matrix";
import { Button } from "torneos/components/ui/button/button";
import { useOnboarding, useAvailabilityMatrix } from "torneos/components/features/onboarding/use-onboarding";

export default function OnboardingPage() {
  const { completeOnboarding, isSubmitting, setIsSubmitting } = useOnboarding();
  const { availabilities, isLoading, toggleSlot } = useAvailabilityMatrix();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Espejo zod de profile.completeOnboarding (displayName min1 max50 · phone max20 · bio max500).
  // Convención: deshabilita el submit, jamás bloquea post-submit.
  const nameOk = displayName.trim().length >= 1 && displayName.trim().length <= 50;
  const phoneOk = phone.trim().length <= 20;
  const bioOk = bio.trim().length <= 500;
  const canSubmit = nameOk && phoneOk && bioOk;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        displayName: displayName.trim(),
        phone: phone.trim() === "" ? undefined : phone.trim(),
        bio: bio.trim() === "" ? undefined : bio.trim(),
      });
      // Éxito: el hook refresca el token y redirige (contrato intacto).
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo guardar tu perfil. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-full pt-14 px-4 pb-4 flex flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tight text-cypher-4">Configura tu perfil</h1>
        <p className="mt-1 text-sm text-cypher-4-2">Di quién eres y cuándo juegas. Podrás ajustarlo después.</p>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6">
        {/* 1 — Datos básicos */}
        <section className="rounded-2xl bg-cypher-5-1 border border-cypher-4-2-2/20 p-5 flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-black text-cypher-1">1</span>
            <h2 className="text-sm font-bold uppercase tracking-wide text-cypher-4">Datos básicos</h2>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="displayName" className="text-xs font-bold uppercase text-cypher-4-2">
              Nombre de jugador *
            </label>
            <input
              id="displayName"
              type="text"
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ej: El Bicho FC"
              className="h-11 rounded-xl bg-cypher-5-1-1 px-3 text-base text-cypher-4 placeholder:text-cypher-4-2-2 outline-none focus:ring-2 focus:ring-cypher-2/60"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-xs font-bold uppercase text-cypher-4-2">
              Teléfono (opcional)
            </label>
            <input
              id="phone"
              type="tel"
              maxLength={20}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+57 300 000 0000"
              className="h-11 rounded-xl bg-cypher-5-1-1 px-3 text-base text-cypher-4 placeholder:text-cypher-4-2-2 outline-none focus:ring-2 focus:ring-cypher-2/60"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio" className="text-xs font-bold uppercase text-cypher-4-2">
              Bio (opcional)
            </label>
            <textarea
              id="bio"
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Cuéntale a la cancha tu estilo de juego…"
              className="rounded-xl bg-cypher-5-1-1 p-3 text-base text-cypher-4 placeholder:text-cypher-4-2-2 outline-none focus:ring-2 focus:ring-cypher-2/60 resize-none"
            />
          </div>
        </section>

        {/* 2 — Disponibilidad */}
        <section className="rounded-2xl bg-cypher-5-1 border border-cypher-4-2-2/20 p-5 flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-black text-cypher-1">2</span>
            <h2 className="text-sm font-bold uppercase tracking-wide text-cypher-4">Disponibilidad</h2>
          </div>
          <p className="text-xs text-cypher-4-2-2">
            Toca una casilla para alternarla. Verde = disponible · Gris = no disponible.
          </p>

          {isLoading ? (
            <div className="h-64 rounded-xl bg-cypher-5-1-1 animate-pulse" aria-label="Cargando disponibilidad" />
          ) : (
            <AvailabilityMatrix slots={availabilities} onToggleSlot={toggleSlot} />
          )}
        </section>

        {/* CTA sticky: mt-auto lo ancla abajo con contenido corto; sticky lo mantiene visible con scroll largo */}
        <div className="sticky bottom-0 mt-auto -mx-4 px-4 pt-4 pb-2 bg-cypher-5/80 backdrop-blur-sm">
          {submitError && (
            <p role="alert" className="mb-2 text-center text-sm text-red-400">{submitError}</p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Guardando…" : "Ir a la cancha"}
          </Button>
          {!nameOk && (
            <p className="mt-2 text-center text-xs text-cypher-4-2-2">
              El nombre de jugador es obligatorio (máx. 50 caracteres).
            </p>
          )}
        </div>
      </form>
    </main>
  );
}