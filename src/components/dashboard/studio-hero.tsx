'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { format, getDayOfYear } from 'date-fns';
import type { Project, User } from '@/types/database';

/* Rotating daily studio note — one per day, deterministic, no repeats until the list cycles. */
const STUDIO_NOTES: { text: string; by: string }[] = [
  { text: 'Less, but better.', by: 'Dieter Rams' },
  { text: 'The details are not the details. They make the design.', by: 'Charles Eames' },
  { text: 'Design is thinking made visual.', by: 'Saul Bass' },
  { text: 'Creativity takes courage.', by: 'Henri Matisse' },
  { text: 'Inspiration exists, but it has to find you working.', by: 'Pablo Picasso' },
  { text: 'You can’t use up creativity. The more you use, the more you have.', by: 'Maya Angelou' },
  { text: 'There are three responses to a piece of design — yes, no, and wow.', by: 'Milton Glaser' },
  { text: 'Styles come and go. Good design is a language, not a style.', by: 'Massimo Vignelli' },
  { text: 'Inspiration is for amateurs — the rest of us just show up and get to work.', by: 'Chuck Close' },
  { text: 'Simplicity is the ultimate sophistication.', by: 'Leonardo da Vinci' },
  { text: 'Design is intelligence made visible.', by: 'Alina Wheeler' },
  { text: 'Every child is an artist. The problem is staying an artist when you grow up.', by: 'Pablo Picasso' },
];

function greetingFor(hour: number): string {
  if (hour < 5) return 'Burning the midnight oil';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Night shift';
}

interface StudioHeroProps {
  user: User;
  projects: Project[];
}

export function StudioHero({ user, projects }: StudioHeroProps) {
  const now = new Date();
  const firstName = user.full_name.split(' ')[0];
  const greeting = greetingFor(now.getHours());
  const note = STUDIO_NOTES[getDayOfYear(now) % STUDIO_NOTES.length];

  const wall = useMemo(() => projects.filter((p) => p.status === 'active'), [projects]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="grain overflow-hidden rounded-card border border-border bg-card px-6 py-6 sm:px-8 sm:py-7"
    >
      {/* Oversized editorial flourish */}
      <span className="pointer-events-none absolute -right-6 -top-14 select-none font-display text-[11rem] font-semibold leading-none text-accent/[0.08]">
        ✳
      </span>

      <div className="relative">
        <p className="eyebrow">
          {format(now, 'EEEE')} · {format(now, 'd MMMM yyyy')} · MPIRE Studio
        </p>
        <h2 className="text-display mt-2 text-4xl text-text sm:text-5xl">
          {greeting}, {firstName}.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          “{note.text}” <span className="text-faint">— {note.by}</span>
        </p>

        {/* The studio wall — one stripe per active project */}
        {wall.length > 0 && (
          <Link href="/projects" className="group mt-6 block">
            <div className="flex h-2.5 overflow-hidden rounded-full">
              {wall.map((p) => (
                <div key={p.id} className="flex-1 transition-opacity group-hover:opacity-80" style={{ backgroundColor: p.color }} title={p.name} />
              ))}
            </div>
            <p className="mt-2 text-[11px] font-semibold text-faint transition-colors group-hover:text-accent">
              {wall.length} active project{wall.length === 1 ? '' : 's'} on the wall →
            </p>
          </Link>
        )}
      </div>
    </motion.div>
  );
}
