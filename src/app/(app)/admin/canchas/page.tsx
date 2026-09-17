import { AdminCourtTemplate } from "torneos/components/features/court/admin-court-template";

// W5 — Entry admin de canchas, re-skin al dispositivo. Sin guard nuevo: los
// procedimientos court.* ya exigen sus permisos en el backend.

export default function AdminCourtsPage() {
  return (
    <div className="px-5 py-6">
      <h1 className="mb-6 text-xl font-bold text-cypher-4">Gestión de canchas</h1>
      <AdminCourtTemplate />
    </div>
  );
}