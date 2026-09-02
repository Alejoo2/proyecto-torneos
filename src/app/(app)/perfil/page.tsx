import { redirect } from "next/navigation";
import { auth } from "torneos/server/auth";
import { ProfileEditView } from "torneos/components/features/profile/templates/profile-edit-view";

export default async function PerfilPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <ProfileEditView />;
}