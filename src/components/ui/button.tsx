import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
