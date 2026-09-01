import Link from "next/link";
import { auth } from "torneos/server/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-8">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-black uppercase tracking-tight">
            Torneos <span className="text-emerald-500">de Barrio</span>
          </h1>
          <p className="text-zinc-400 mt-2 text-sm uppercase tracking-widest">
            Plataforma en construcción
          </p>
        </div>

        {/* Auth Section */}
        <div className="flex flex-col items-center gap-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          {session?.user ? (
            <>
              <p className="text-lg font-bold text-center">
                Bienvenido, <span className="text-emerald-500">{session.user.name ?? "Jugador"}</span>
              </p>
              <Link
                href="/api/auth/signout"
                className="w-full text-center bg-zinc-800 text-white px-6 py-2 rounded-md font-bold uppercase tracking-wide hover:bg-zinc-700 transition-colors"
              >
                Cerrar Sesión
              </Link>
            </>
          ) : (
            <Link
              href="/api/auth/signin"
              className="w-full text-center bg-emerald-500 text-zinc-950 px-6 py-2 rounded-md font-black uppercase tracking-wide hover:bg-emerald-400 transition-colors"
            >
              Iniciar Sesión
            </Link>
          )}
        </div>

        {/* Navigation Hub */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold uppercase border-b border-zinc-800 pb-2">
            Navegación (Demo)
          </h2>
          
          <div className="flex flex-col gap-3">
            <Link 
              href="/onboarding" 
              className="block bg-zinc-900 p-4 rounded-lg border border-zinc-800 hover:border-emerald-500 transition-colors"
            >
              <h3 className="font-bold uppercase text-emerald-500">Sistema 2: Onboarding</h3>
              <p className="text-zinc-400 text-sm mt-1">Configuración de perfil y matriz de disponibilidad.</p>
            </Link>

            <Link 
              href="/config" 
              className="block bg-zinc-900 p-4 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors opacity-50 cursor-not-allowed"
              aria-disabled="true"
            >
              <h3 className="font-bold uppercase text-zinc-500">Sistema 3: Equipos (Próximamente)</h3>
              <p className="text-zinc-500 text-sm mt-1">Gestión de equipos y plantillas.</p>
            </Link>

            <Link 
              href="/config/torneos" 
              className="block bg-zinc-900 p-4 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors opacity-50 cursor-not-allowed"
              aria-disabled="true"
            >
              <h3 className="font-bold uppercase text-zinc-500">Sistema 6: Torneos (Próximamente)</h3>
              <p className="text-zinc-500 text-sm mt-1">Inscripción y sala de cine.</p>
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}