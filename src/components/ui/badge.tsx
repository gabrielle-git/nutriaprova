import * as React from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-sans text-[12px] font-medium leading-none tracking-[0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15",
        secondary: "border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] text-[hsl(var(--ink-2))] hover:bg-[hsl(var(--surface-3))]/50",
        destructive:
          "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950/70",
        outline: "border border-[hsl(var(--surface-3))] bg-transparent text-[hsl(var(--ink-2))] hover:bg-[hsl(var(--surface-2))]/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      <motion.span
        className="inline-flex items-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 20 }}
      >
        {children}
      </motion.span>
    </div>
  );
}

export { Badge, badgeVariants };
