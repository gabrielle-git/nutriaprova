import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Lightweight CSS-based page transition: fade in + slight slide up.
 * Uses tailwind animate-fade-in (0.3s) defined in tailwind.config.ts.
 */
export default function PageTransition({ children, className = "" }: PageTransitionProps) {
  return <div className={`animate-fade-in ${className}`}>{children}</div>;
}
