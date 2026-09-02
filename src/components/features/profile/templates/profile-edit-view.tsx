"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useMyProfile, useToggleSlot, useUpdateProfile } from "torneos/components/features/profile/use-profile";
import { AvailabilityMatrix } from "torneos/components/ui/availability-matrix/availability-matrix";

export function ProfileEditView() {
  const { data: profile, isLoading } = useMyProfile();
  const { mutate: toggleSlot } = useToggleSlot();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile();

  // Estado local para el formulario
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  // Cargar datos en el formulario cuando llega la data del backend
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setPhone(profile.phone ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="flex min-h-100dvh justify-center items-center bg-white">
        <p className="text-gray-500">Cargando perfil...</p>
      </div>
    );
  }

  if (!profile?.player) {
    return (
      <div className="flex flex-col min-h-100dvh justify-center items-center bg-white gap-4 p-6 text-center">
        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Aún no eres jugador</h2>
        <p className="text-sm text-gray-500">Completa tu onboarding para configurar tu disponibilidad.</p>
        <Link 
          href="/onboarding" 
          className="mt-4 bg-gray-900 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-gray-800 transition-colors"
        >
          Ir a Onboarding
        </Link>
      </div>
    );
  }

  // Mapear los slots para la UI
  const allSlots = Array.from({ length: 12 }, (_, timeSlot) => 
    Array.from({ length: 7 }, (_, dayIndex) => {
      const dayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1; 
      const found = profile.player?.availabilities.find(
        a => a.dayOfWeek === dayOfWeek && a.timeSlot === timeSlot
      );
      return {
        dayOfWeek,
        timeSlot,
        status: found?.status ?? "UNAVAILABLE",
      };
    })
  ).flat();

  // Enviar actualización de perfil
  const handleSaveProfile = () => {
    updateProfile({
      displayName,
      phone,
      bio,
    });
  };

  return (
    <div className="flex flex-col min-h-100dvh bg-gray-50">
      
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-44px min-h-44px"
              aria-label="Volver al inicio"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Mi Perfil</h2>
              <p className="text-xs text-gray-500">Datos y disponibilidad</p>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6">
        
        {/* DATOS PERSONALES */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Datos Personales</h3>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-500">Nombre Visible</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-gray-800 transition-all text-gray-900 text-sm"
              placeholder="¿Cómo te llaman en la cancha?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-500">Teléfono (Opcional)</label>
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-gray-800 transition-all text-gray-900 text-sm"
              placeholder="+54 9 11 1234-5678"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-500">Biografía (Opcional)</label>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-gray-800 transition-all text-gray-900 text-sm resize-none"
              placeholder="Cuéntale a los capitanes un poco sobre ti..."
            />
          </div>

          <button 
            onClick={handleSaveProfile}
            disabled={isUpdating}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-gray-800 active:scale-[0.98] transition-all disabled:bg-gray-300"
          >
            {isUpdating ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>

        {/* DISPONIBILIDAD */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Disponibilidad Horaria</h3>
          <div className="overflow-x-auto pb-2">
            <AvailabilityMatrix 
              slots={allSlots} 
              onToggleSlot={(dayOfWeek, timeSlot) => toggleSlot({ dayOfWeek, timeSlot })}
            />
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 px-4">
          Toca los cuadros para marcar o desmarcar las franjas horarias en las que sueles estar disponible para jugar.
        </div>
      </main>
    </div>
  );
}