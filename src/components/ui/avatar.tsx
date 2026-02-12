import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-[11px]',
  lg: 'h-10 w-10 text-[13px]',
};

function Avatar({ name, src, size = 'md', className, ...props }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          'shrink-0 rounded-lg object-cover',
          sizeClasses[size],
          className
        )}
        {...(props as React.ImgHTMLAttributes<HTMLImageElement>)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-accent font-bold text-white',
        sizeClasses[size],
        className
      )}
      title={name}
      {...props}
    >
      {initials}
    </div>
  );
}

export { Avatar };
