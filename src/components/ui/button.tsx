import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-display font-medium tracking-[-0.01em] ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-0",
  {
    variants: {
      variant: {
        default: "btn-primary !font-medium",
        destructive: "bg-[hsl(var(--danger))] text-destructive-foreground hover:shadow-md",
        outline:
          "rounded-[var(--radius-sm)] border border-primary bg-background text-primary hover:bg-[hsl(var(--primary)/0.06)]",
        secondary: "bg-secondary text-secondary-foreground rounded-[var(--radius-sm)] hover:bg-secondary/80 hover:-translate-y-0.5",
        ghost:
          "text-[hsl(var(--ink-1))] rounded-[var(--radius-sm)] hover:bg-[hsl(var(--surface-2))]",
        link: "text-primary font-medium underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const motionSpring = { type: "spring" as const, stiffness: 400, damping: 17 };

function buttonMotionProps(variant: VariantProps<typeof buttonVariants>["variant"]) {
  const v = variant ?? "default";
  const base = {
    whileTap: { scale: 0.97 },
    transition: motionSpring,
  };
  if (v === "default") {
    return {
      ...base,
      whileHover: {
        scale: 1.02,
        y: -1,
        boxShadow: "0 8px 24px hsl(158 72% 32% / 0.4)",
      },
    };
  }
  if (v === "destructive") {
    return {
      ...base,
      whileHover: {
        scale: 1.02,
        boxShadow: "0 8px 24px hsl(0 78% 54% / 0.4)",
      },
    };
  }
  return base;
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const MotionButton = motion.button;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (asChild) {
      const Comp = Slot;
      return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
    }
    const m = buttonMotionProps(variant);
    return (
      <MotionButton ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...m} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
