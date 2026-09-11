"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "torneos/trpc/react";
import { TournamentStatsGrid } from "torneos/components/ui/tournament/tournament-stats-grid";
import { EnrolledTeamCard } from "torneos/components/ui/tournament/enrolled-team-card";
import { SalaCineModal } from "torneos/components/ui/tournament/sala-cine-modal";
import { Button } from "torneos/components/ui/button/button";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SLOTS = ["00:00 - 02:00", "02:00 - 04:00", "04:00 - 06:00", "06:00 - 08:00", "08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00", "14:00 - 16:00", "16:00 - 18:00", "18:00 - 20:00", "20:00 - 22:00", "22:00 - 00:00"];

interface TournamentDetailTemplateProps {
  tournamentId: string;
  isLoggedIn: boolean;
}

export function TournamentDetailTemplate({ tournamentId, isLoggedIn }: TournamentDetailTemplateProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const [enrollmentResult, setEnrollmentResult] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Detalle ramificado por sesión: anónimo → read-model de vitrina
  // (solo APPROVED, sin manager ni holds); logueado → getById igual que hoy.
  const { data: publicTournament, isLoading: publicLoading } = api.tournament.getPublicById.useQuery(
    { tournamentId },
    { enabled: !isLoggedIn },
  );
  const { data: managedTournament, isLoading: managedLoading } = api.tournament.getById.useQuery(
    { tournamentId },
    { enabled: isLoggedIn, retry: false },
  );
  const tournament = isLoggedIn ? managedTournament : publicTournament;
  const isLoading = isLoggedIn ? managedLoading : publicLoading;

  // Sala de Cine: SOLO con sesión (§3.4 — nunca en anónimo)
  const { data: holdData } = api.tournament.checkHold.useQuery(
    { tournamentId },
    { enabled: isLoggedIn, retry: false, refetchInterval: 1000 },
  );
  const { data: myTeams } = api.team.getMyTeams.useQuery(undefined, {
    enabled: isLoggedIn,
    retry: false,
  });

  // Mutations (solo alcanzables con sesión: los disparan botones gated)
  const utils = api.useUtils();

  const holdSlotMutation = api.tournament.holdSlot.useMutation({
    onSuccess: () => {
      setSecondsRemaining(300);
      setIsModalOpen(true);
    },
  });

  const enrollMutation = api.enrollment.enroll.useMutation({
    onSuccess: (data) => {
      setIsModalOpen(false);
      if (data.status === "PENDING_PAYMENT") {
        setEnrollmentResult("SUCCESS");
      } else if (data.status === "PENDING_AVAILABILITY") {
        setEnrollmentResult("CONFLICT");
      }
      utils.tournament.getById.invalidate({ tournamentId });
    },
  });

  // Countdown effect
  useEffect(() => {
    if (isModalOpen && secondsRemaining > 0) {
      const timer = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (secondsRemaining === 0) {
      setIsModalOpen(false);
    }
  }, [isModalOpen, secondsRemaining]);

  // Auto-seleccionar el primer equipo si solo tiene uno
  useEffect(() => {
    if (myTeams && myTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(myTeams[0].id);
    }
  }, [myTeams, selectedTeamId]);

  if (isLoading || !tournament) {
    return <div className="p-6 text-zinc-500">Cargando torneo...</div>;
  }

  // En vitrina el engine ya manda solo APPROVED; en sesión filtra como hoy
  const activeEnrollments = tournament.enrollments.filter(e =>
    ["APPROVED", "PENDING_PAYMENT", "PENDING_AVAILABILITY"].includes(e.status)
  );

  const handleEnroll = () => {
    if (!selectedTeamId) {
      alert("Por favor selecciona un equipo.");
      return;
    }
    enrollMutation.mutate({ tournamentId, teamId: selectedTeamId });
  };

  return (
    <div className="pb-8">
      {/* Header info */}
      <div className="px-6 pt-5 pb-4">
        <h1 className="text-xl font-bold text-zinc-900 mb-1 leading-tight">{tournament.name}</h1>
        <p className="text-sm text-zinc-500">{tournament.court.name}</p>
      </div>

      <TournamentStatsGrid
        enrolledCount={activeEnrollments.length}
        maxTeams={tournament.maxTeams}
        dayOfWeek={DAYS[tournament.dayOfWeek]}
        timeSlot={SLOTS[tournament.timeSlot]}
        enrollmentDeadline={new Date(tournament.enrollmentDeadline).toLocaleDateString("es-CO")}
        format={tournament.format.replace("_", " ")}
      />

      {/* Descripción */}
      <div className="px-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide mb-2">Descripción</h2>
        <p className="text-sm text-zinc-600 leading-relaxed">{tournament.description || "Sin descripción"}</p>
      </div>

      {/* CTA anónimo: el clic prohibido no existe — lo mandamos a login (§3.7) */}
      {!isLoggedIn && tournament.status === "SCHEDULED" && (
        <div className="px-6 mb-8">
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/torneos/${tournamentId}`)}`}
            className="block w-full rounded-2xl bg-zinc-900 py-4 text-center text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Entrar para inscribir tu equipo
          </Link>
          <p className="mt-2 text-xs text-center text-zinc-400">
            Inicia sesión con tu equipo para reservar un cupo
          </p>
        </div>
      )}

      {/* Acción Capitán (myTeams solo carga con sesión) */}
      {isLoggedIn && tournament.status === "SCHEDULED" && myTeams && myTeams.length > 0 && !holdData && (
        <div className="px-6 mb-8 space-y-3">
          {myTeams.length > 1 && (
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full h-12 bg-zinc-50 rounded-xl border border-zinc-200 px-4 focus:border-zinc-400 focus:outline-none"
            >
              {myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <Button
            className="w-full min-h-[56px]"
            onClick={() => holdSlotMutation.mutate({ tournamentId })}
            disabled={holdSlotMutation.isPending}
          >
            {holdSlotMutation.isPending ? "Reservando..." : `Inscribir a ${myTeams.find(t => t.id === selectedTeamId)?.name || "equipo"}`}
          </Button>
          <p className="text-xs text-center text-zinc-400">Se reservará un cupo por 5 minutos</p>
        </div>
      )}

      {/* Mensaje de no-capitán: NUNCA al anónimo (spec Paso D) */}
      {isLoggedIn && tournament.status === "SCHEDULED" && (!myTeams || myTeams.length === 0) && (
        <div className="px-6 mb-8">
          <div className="bg-zinc-50 rounded-2xl p-4 text-center border border-zinc-100">
            <p className="text-sm text-zinc-500">Solo los capitanes pueden inscribir equipos</p>
          </div>
        </div>
      )}

      {/* Hold activo (requiere sesión por el gate del query) */}
      {holdData && (
        <div className="px-6 mb-8">
          <Button className="w-full min-h-[56px] bg-orange-500 hover:bg-orange-600" onClick={() => setIsModalOpen(true)}>
            Tienes una reserva activa ({holdData.secondsRemaining}s)
          </Button>
        </div>
      )}

      {/* Equipos Inscritos (en anónimo: solo APPROVED, los manda el engine) */}
      <div className="px-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-zinc-900">Equipos inscritos</h2>
          <span className="text-xs text-zinc-400 font-mono">{activeEnrollments.length}/{tournament.maxTeams}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {activeEnrollments.map((env) => (
            <EnrolledTeamCard
              key={env.id}
              teamId={env.team.id}
              name={env.team.name}
              abbreviation={env.team.abbreviation}
              primaryColor={env.team.primaryColor}
              status={env.status}
              availabilityNote={env.availabilityNote}
            />
          ))}
        </div>
      </div>

      {/* Modal Sala de Cine: no se monta sin sesión ni sin hold/flujo propio */}
      {isLoggedIn && (isModalOpen || !!holdData) && (
        <SalaCineModal
          isOpen={isModalOpen}
          secondsRemaining={secondsRemaining}
          teamName={myTeams?.find(t => t.id === selectedTeamId)?.name}
          isEnrolling={enrollMutation.isPending}
          onConfirm={handleEnroll}
          onCancel={() => setIsModalOpen(false)}
        />
      )}

      {/* Modal de Resultado (solo alcanzable tras enroll con sesión) */}
      {enrollmentResult && (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center">
            {enrollmentResult === "SUCCESS" ? (
              <>
                <h3 className="text-lg font-bold text-zinc-900 mb-2">¡Inscripción enviada!</h3>
                <p className="text-sm text-zinc-500 mb-4">Tu equipo cumple con la disponibilidad. El gestor debe verificar el pago.</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-zinc-900 mb-2">Disponibilidad insuficiente</h3>
                <p className="text-sm text-zinc-500 mb-4">No tienes 5 jugadores disponibles en esta franja.</p>
              </>
            )}
            <Button className="w-full" onClick={() => setEnrollmentResult(null)}>Entendido</Button>
          </div>
        </div>
      )}
    </div>
  );
}