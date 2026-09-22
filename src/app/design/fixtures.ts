import type { NotificationData } from "torneos/components/features/notifications/notification-item";

// SOLO para /design. Nada de src/ importa este módulo (costura 7.3 aplicada a demos).

const NOW = Date.now();

export const FIXTURE_NOTIFICATIONS: NotificationData[] = [
  {
    id: "n1",
    family: "TOURNAMENT",    title: "Inscripción aprobada",
    body: "Tu equipo 'Los Rayados' fue aprobado en la Copa Barrial Nocturna.",
    createdAt: NOW - 42_000,
    read: false,
  },
  {
    id: "n2",
    family: "MATCH",
    title: "Partido aplazado",
    body: "El partido vs 'Deportivo Nobsa' pasó al sábado 8:00 pm por lluvia.",
    createdAt: NOW - 600_000,
    read: false,
  },
  {
    id: "n3",
    family: "TOURNAMENT",
    title: "Cupos por agotarse",
    body: "Quedan 2 cupos en la Liga Empresarial de Microfútbol.",
    createdAt: NOW - 5_400_000,
    read: true,
  },
  {
    id: "n4",
    family: "TEAM",
    title: "Solicitud de fichaje",
    body: "Andrés Peña quiere unirse a tu plantilla.",
    createdAt: NOW - 86_400_000,
    read: true,
  },
];

export const FIXTURE_TEAMS = {
  local: { name: "Los Rayados", abbreviation: "RAY", primaryColor: "#CCFF00" },
  visit: { name: "Deportivo Nobsa", abbreviation: "NOB", primaryColor: "#7B2CBF" },
};

export const FIXTURE_PLAYERS = {
  withImage: { displayName: "Carlos Mendoza", image: null as string | null },
  noImage: { displayName: "Andrés Peña", image: null as string | null },
};