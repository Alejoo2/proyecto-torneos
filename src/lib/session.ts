import type { Session } from "next-auth";
import { db } from "torneos/server/db";


/**
 * Claim `onboarded` viaja en la sesión (lo sube el callback de session);
 * no está en el tipo base de User, de ahí el cast único y centralizado.
 */
export function isOnboarded(session: Session | null): boolean {
  const user = session?.user as { onboarded?: boolean } | undefined;
  return !!user?.onboarded;
}

/**
 * N-1 (W7): derivación server-side de ADMIN para el adminHref del BottomNav.
 * El sistema de roles es tablas (Role/RoleAssignment por profileId): la sesión
 * no porta rol. Lectura directa y fail-closed: sin asignación del rol "admin"
 * la pestaña no se renderiza. W10 refinará el RBAC de la zona admin.
 */
export async function isAdminSession(session: Session | null): Promise<boolean> {
  const profileId = session?.user.profileId;
  if (!profileId) return false;
  const assignment = await db.roleAssignment.findFirst({
    where: { profileId, role: { name: "admin" } },
    select: { id: true },
  });
  return assignment !== null;
}