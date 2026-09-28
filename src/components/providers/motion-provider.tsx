"use client";

import { MotionConfig } from "motion/react";

/** UI-AUDIT-02: el motion JS (AnimatePresence/springs en 7 sitios) respeta
 *  prefers-reduced-motion del SO en todo el front. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
