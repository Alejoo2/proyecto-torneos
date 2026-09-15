import Link from "next/link";
import { api } from "torneos/trpc/server";
import { DAY_SHORT, slotToLabel } from "torneos/lib/hub";

export default async function TournamentsPage() {
  // Read-model de vitrina: PUBLIC + statuses publicados, cupos = APPROVED.
  const tournaments = await api.tournament.listPublic();

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-zinc-900">Torneos</h1>
        <p className="text-sm text-zinc-500">Inscripciones abiertas en tu zona</p>
      </header>

      {tournaments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="text-sm text-zinc-500">
            No hay torneos publicados por ahora.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3 p-4">
          {tournaments.map((t: (typeof tournaments)[number]) => (
            <li key={t.id}>
              <Link
                href={`/torneos/${t.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50"
              >
                <h2 className="font-semibold text-zinc-900">{t.name}</h2>
                <p className="mt-0.5 text-sm text-zinc-500">{t.court.name}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-700">
                    {DAY_SHORT[t.dayOfWeek] ?? ""} · {slotToLabel(t.timeSlot)}
                  </span>
                  <span className="font-medium text-zinc-900">
                    {t._count.enrollments}/{t.maxTeams} equipos
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}