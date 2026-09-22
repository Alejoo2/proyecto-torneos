"use client";

import { useState } from "react";
import { api } from "torneos/trpc/react";
import { Badge } from "torneos/components/ui/badge";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import { cn } from "torneos/lib/utils";

const INPUT_CLS =
  "w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2";

/** W10 — Pestaña Árbitros (alta + toggle isActive). Match.referee es SetNull:
 *  desactivar nunca rompe partidos históricos. Toggle optimistic con rollback. */
export function AdminRefereesTab() {
  const utils = api.useUtils();
  const [toast, setToast] = useState<{ title: string } | null>(null);
  const notify = (title: string) => setToast({ title });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const { data: referees, isLoading } = api.admin.listRefereesAdmin.useQuery();

  const createMutation = api.admin.createReferee.useMutation({
    onSuccess: () => {
      notify("Árbitro registrado");
      setName(""); setPhone(""); setEmail("");
      void utils.admin.listRefereesAdmin.invalidate();
    },
    onError: (e) => notify(e.message),
  });

  const toggleMutation = api.admin.updateReferee.useMutation({
    onMutate: async ({ refereeId, isActive }) => {
      await utils.admin.listRefereesAdmin.cancel();
      const prev = utils.admin.listRefereesAdmin.getData();
      utils.admin.listRefereesAdmin.setData(undefined, (old) =>
        old?.map((r) => (r.id === refereeId ? { ...r, isActive: isActive ?? r.isActive } : r)),
      );
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.admin.listRefereesAdmin.setData(undefined, ctx.prev);
      notify(e.message);
    },
    onSettled: () => void utils.admin.listRefereesAdmin.invalidate(),
  });

  const canCreate = name.trim().length >= 2;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Registrar árbitro
        </h2>
        <div className="space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
            placeholder="Nombre del árbitro (req.)" className={INPUT_CLS} />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30}
            placeholder="Teléfono (opcional)" className={INPUT_CLS} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (opcional)" className={INPUT_CLS} />
          <button
            type="button"
            disabled={!canCreate || createMutation.isPending}
            onClick={() => createMutation.mutate({
              name: name.trim(),
              phone: phone.trim() || undefined,
              email: email.trim() || undefined,
            })}
            className="w-full rounded-xl bg-cypher-2 py-3 text-sm font-bold text-cypher-5 transition-colors active:bg-cypher-2-1 disabled:opacity-50"
          >
            {createMutation.isPending ? "Registrando..." : "Registrar árbitro"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Catálogo de árbitros
        </h2>
        {isLoading ? (
          <LoadingSkeleton variant="row" rows={3} />
        ) : referees && referees.length > 0 ? (
          <div className="space-y-3">
            {referees.map((referee) => (
              <div
                key={referee.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-cypher-4">{referee.name}</p>
                  <p className="truncate text-xs text-cypher-4-2-2">
                    {referee.phone ?? referee.email ?? "Sin contacto"} · {referee._count.matches} partido(s)
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={referee.isActive ? "success" : "neutral"} status={referee.isActive ? "Activo" : "Inactivo"} />
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ refereeId: referee.id, isActive: !referee.isActive })}
                    aria-label={referee.isActive ? `Desactivar a ${referee.name}` : `Activar a ${referee.name}`}
                    className={cn(
                      "relative h-8 w-14 shrink-0 rounded-full transition-colors",
                      referee.isActive ? "bg-cypher-3" : "bg-cypher-5",
                    )}
                  >
                                        <span
                      className={cn(
                        "absolute left-0 top-1 size-6 rounded-full bg-white transition-transform",
                        referee.isActive ? "translate-x-7" : "translate-x-1",
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-cypher-4-2-2">No hay árbitros registrados.</p>
        )}
      </section>

      <Toast toast={toast} />
    </div>
  );
}