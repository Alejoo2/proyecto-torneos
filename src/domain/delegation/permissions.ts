// Delegación v2 — catálogo de permisos delegables (fuente única DRY).
// El gestor los otorga con texto descriptivo (como roles del admin).
// Códigos estables: el engine los exige por helper, jamás por rol.

export interface DelegablePermission {
  code: string;
  title: string;
  description: string;
  enables: string;
  disables: string;
}

export const DELEGABLE_PERMISSIONS: DelegablePermission[] = [
  {
    code: "match:postpone",
    title: "Aplazar partidos",
    description: "Pausar un partido programado con motivo obligatorio.",
    enables: "Aplaza SCHEDULED/IN_PROGRESS → POSTPONED y libera la franja.",
    disables: "No puede reprogramar, declarar ausencias ni cargar resultados.",
  },
  {
    code: "match:reschedule",
    title: "Reprogramar partidos",
    description: "Dar nueva fecha a partidos aplazados.",
    enables: "Elige franja AVAILABLE y el partido vuelve a SCHEDULED.",
    disables: "No puede aplazar, declarar ausencias ni cargar resultados.",
  },
  {
    code: "match:walkover",
    title: "Declarar ausencias (W.O.)",
    description: "Marcar qué equipo se presenta; el ausente queda eliminado.",
    enables: "Cierra el partido como WALKOVER y avanza al presente.",
    disables: "Irreversible: no aplaza ni reprograma después.",
  },
  {
    code: "referee:assign",
    title: "Asignar árbitros",
    description: "Poner o quitar árbitro del directorio en cada partido.",
    enables: "Solo asigna; no toca estados ni resultados.",
    disables: "No gestiona el directorio (eso es admin).",
  },
  {
    code: "match:result",
    title: "Cargar resultados",
    description: "Cargar goles y estadísticas individuales por partido.",
    enables: "Emite FINISHED, avanza el bracket y recalcula stats.",
    disables: "No puede editar ni borrar resultados cargados.",
  },
  {
    code: "enrollment:manage",
    title: "Gestionar inscripciones",
    description: "Ver la bandeja del torneo y aprobar/rechazar equipos.",
    enables: "Aprueba pagos y rechaza con motivo (≥10 caracteres).",
    disables: "No crea torneos ni cierra el sorteo.",
  },
];

export const DELEGABLE_CODES = DELEGABLE_PERMISSIONS.map((p) => p.code);

export function isDelegable(code: string): boolean {
  return DELEGABLE_CODES.includes(code);
}
