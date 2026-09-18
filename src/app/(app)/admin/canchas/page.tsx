import { AdminCourtTemplate } from "torneos/components/features/court/admin-court-template";

// W5 — Entry admin de canchas, re-skin al dispositivo. Sin guard nuevo: los
// procedimientos court.* ya exigen sus permisos en el backend.
// QA-W5: espaciado de escena — pt-14 despeja el AppHeader sticky, pb-28 despeja
// la BottomNav (64px + safe-area). El shell no se toca: la escena se compensa.

export default function AdminCourtsPage() {
  return (
    <div className="px-5 pt-14 pb-28">
      <h1 className="mb-6 text-xl font-bold text-cypher-4">Gestión de canchas</h1>
      <AdminCourtTemplate />
    </div>
  );
}