"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "torneos/components/ui/button/button";

export default function DevLoginPage() {
  const [email, setEmail] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Usamos el callbackUrl "/" para que entre al Hub directamente
    await signIn("credentials", { email, callbackUrl: "/" });
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-cypher-5-1-1 text-cypher-1">
          <FlaskConical className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-cypher-4">Dev Login</h1>
        <p className="mt-1 text-sm text-cypher-4-2">Solo testing — no existe en producción.</p>
      </div>

      <form onSubmit={handleLogin} className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ej: capitan@barrio.com"
          required
          aria-label="Email del usuario de prueba"
          className="h-11 rounded-xl bg-cypher-5-1-1 px-3 text-base text-cypher-4 placeholder:text-cypher-4-2-2 outline-none focus:ring-2 focus:ring-cypher-2/60"
        />
        <Button type="submit" className="w-full">
          Entrar como este usuario
        </Button>
      </form>

      <p className="mt-8 max-w-sm text-center text-xs text-cypher-4-2-2">
        Si el usuario no existe, se crea al instante con rol jugador y disponibilidad completa.
      </p>
    </main>
  );
}