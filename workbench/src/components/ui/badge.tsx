import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold leading-none [&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:stroke-[1.8]",
  {
    variants: {
      variant: {
        default: "border-ink bg-ink text-paper",
        outline: "border-ink bg-transparent text-ink",
        seal: "border-seal bg-transparent text-seal",
        soft: "border-faint bg-wash text-ink",
        success: "border-[#2e7d62] bg-[#d8eee6] text-[#245f4c]",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
