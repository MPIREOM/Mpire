'use client';

import { motion } from 'framer-motion';
import { InboxIcon } from '@heroicons/react/24/outline';
import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="mb-4 rounded-2xl bg-bg p-4">
        <Icon className="h-8 w-8 text-muted" />
      </div>
      <h3 className="mb-1 text-[15px] font-semibold text-text">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-center text-[13px] text-muted">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="default" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
