import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.8]",
  {
    variants: {
      variant: {
        default:
          "border-2 border-ink bg-ink px-4 py-2 text-paper shadow-[3px_3px_0_var(--seal)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--seal)]",
        seal: "border-2 border-seal bg-seal px-4 py-2 text-white shadow-[3px_3px_0_var(--ink)] hover:-translate-y-0.5",
        outline:
          "border-2 border-ink bg-paper px-4 py-2 text-ink hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--ink)]",
        ghost: "px-3 py-2 text-muted hover:bg-wash hover:text-ink",
        soft: "border border-faint bg-wash px-3 py-2 text-ink hover:border-ink",
      },
      size: {
        default: "h-10",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
