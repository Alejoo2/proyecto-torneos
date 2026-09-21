"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface HeaderTitleValue {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const HeaderTitleContext = createContext<HeaderTitleValue | null>(null);

/** N-4: provider montado en AMBOS layouts alrededor de AppHeader + main. */
export function HeaderTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);
  return <HeaderTitleContext.Provider value={value}>{children}</HeaderTitleContext.Provider>;
}

/** Para templates cliente (lanza si falta el provider — error de integración). */
export function useHeaderTitle(): HeaderTitleValue {
  const ctx = useContext(HeaderTitleContext);
  if (!ctx) throw new Error("useHeaderTitle fuera del HeaderTitleProvider");
  return ctx;
}

/** Lectura tolerante para AppHeader (puede vivir fuera del provider, ej. Stage). */
export function useOptionalHeaderTitle(): HeaderTitleValue | null {
  return useContext(HeaderTitleContext);
}

/** Montador de título para templates cliente. Desmonta el título al desmontar. */
export function HeaderTitle({ title }: { title: string }) {
  const { setTitle } = useHeaderTitle();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
  return null;
}