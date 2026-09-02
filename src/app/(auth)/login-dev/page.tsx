"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function DevLoginPage() {
  const [email, setEmail] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Usamos el callbackUrl "/" para que entre al Hub directamente
    await signIn("credentials", { email, callbackUrl: "/" });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-6">🧪 Dev Login (Solo Testing)</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full max-w-sm">
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ej: capitan@barrio.com"
          className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 outline-none"
          required
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium">
          Entrar como este usuario
        </button>
      </form>
      
      <div className="mt-8 text-sm text-gray-400 text-center">
        <p>Si el usuario no existe, se crea en la BD al instante con rol Player y disponibilidad completa.</p>
        <p className="mt-2">Prueba con: <code className="bg-gray-800 px-2 py-1 rounded">capitan@barrio.com</code> y <code className="bg-gray-800 px-2 py-1 rounded">jugador1@barrio.com</code></p>
      </div>
    </div>
  );
}