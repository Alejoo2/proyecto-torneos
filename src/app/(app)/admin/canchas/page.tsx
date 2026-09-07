import { AdminCourtTemplate } from "torneos/components/features/court/admin-court-template";

export default function AdminCourtsPage() {
  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Gestión de Canchas</h1>
      <AdminCourtTemplate />
    </div>
  );
}