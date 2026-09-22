import { ShieldAlert } from "lucide-react";
import { auth } from "torneos/server/auth";
import { isAdminSession } from "torneos/lib/session";
import { AdminView } from "torneos/components/features/admin/admin-view";
import { HeaderTitle } from "torneos/components/app-shell/header-title";
import { EmptyState } from "torneos/components/ui/empty-state";

// W10: la ruta queda gateada server-side (N-1 solo gateaba el link).
// isAdminSession: lectura roleAssignment por rol "admin", fail-closed.
export default async function AdminPage() {
  const session = await auth();
  const isAdmin = await isAdminSession(session);

  if (!isAdmin) {
    return (
      <div className="pt-14 pb-28">
        <HeaderTitle title="Admin" />
        <div className="px-4 pt-16">
          <EmptyState
            icon={<ShieldAlert className="size-8" />}
            title="Sin acceso"
            description="Solo el administrador puede ver esta sección."
          />
        </div>
      </div>
    );
  }

  return <AdminView />;
}