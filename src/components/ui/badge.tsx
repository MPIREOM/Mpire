import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-bg text-muted',
        success: 'bg-green-bg text-green',
        warning: 'bg-yellow-bg text-yellow',
        danger: 'bg-red-bg text-red',
        info: 'bg-blue-bg text-blue',
        purple: 'bg-[rgba(139,92,246,0.08)] text-purple',
        accent: 'bg-accent-muted text-accent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
