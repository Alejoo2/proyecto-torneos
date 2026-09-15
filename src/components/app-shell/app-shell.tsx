interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Marco-dispositivo universal (doc 2.1). Móvil: ES el teléfono (100dvh).
 * Desktop: simulación de hardware. El div interno es `relative`: es el
 * ancla de TODAS las capas absolutas (panel notificaciones, sheet, toast).
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cypher-5 md:p-[5vh]">
      <div className="relative flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cypher-5/1 text-cypher-4 md:h-[90vh] md:rounded-[2rem] md:border-[10px] md:border-cypher-5-1-1 md:shadow-2xl md:shadow-black/60">
        {children}
      </div>
    </div>
  );
}