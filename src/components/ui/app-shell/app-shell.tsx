interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Frame de aplicación móvil: pantalla completa en móvil,
 * simulación de dispositivo en desktop (como el prototipo).
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 md:p-[5vh]">
      <div className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-white md:h-[90vh] md:rounded-[2rem] md:border-[10px] md:border-zinc-900 md:shadow-2xl">
        {children}
      </div>
    </div>
  );
}