'use client';

import { motion } from 'framer-motion';
import { Skeleton } from './skeleton';

export function TaskListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
        >
          <Skeleton className="h-5 w-5 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </motion.div>
      ))}
    </div>
  );
}

export function KPICardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="mb-2 h-8 w-16" />
          <Skeleton className="h-2.5 w-12" />
        </motion.div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8">
      <KPICardsSkeleton />
      <div>
        <Skeleton className="mb-4 h-4 w-32" />
        <TaskListSkeleton rows={6} />
      </div>
    </div>
  );
}
