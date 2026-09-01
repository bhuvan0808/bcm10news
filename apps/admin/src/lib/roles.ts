import type { UserRole } from '@bcm10/database';

/**
 * Role vocabulary — pure data and pure functions, no server imports.
 *
 * This module exists because both a client component (the People screen) and a
 * server guard need to reason about roles. If these lived in `auth.ts`, which
 * imports `next/headers` through the Supabase server client, importing a label
 * from a `'use client'` file would drag server-only code into the browser
 * bundle and fail the build.
 *
 * It also cannot live in the server-actions file: a `'use server'` module may
 * only export async functions.
 */

/**
 * Numeric privilege weight. Compare ranks rather than enum order, so roles can
 * be reordered without changing behaviour. Mirrors public.role_rank() in SQL.
 */
export const RANKS: Record<UserRole, number> = {
  super_admin: 100,
  managing_editor: 80,
  editor: 60,
  subscription_manager: 40,
  reporter: 30,
  photographer: 20,
  business_customer: 10,
  reader: 0,
};

export function rank(role: UserRole): number {
  return RANKS[role] ?? 0;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super admin',
  managing_editor: 'Managing editor',
  editor: 'Editor',
  reporter: 'Reporter',
  photographer: 'Photographer',
  subscription_manager: 'Subscription manager',
  business_customer: 'Business account',
  reader: 'Reader',
};

/**
 * Roles an admin may assign, described in terms of what the person will be able
 * to do — that is the decision being made, not which enum value gets stored.
 */
export const ASSIGNABLE_ROLES = [
  {
    value: 'reporter',
    label: 'Reporter',
    description: 'Files stories and uploads pictures. Cannot publish unless you grant it below.',
  },
  {
    value: 'photographer',
    label: 'Photographer',
    description: 'Uploads and manages media. Cannot publish articles.',
  },
  {
    value: 'editor',
    label: 'Editor',
    description: 'Reviews submissions, edits anyone’s story, and publishes.',
  },
  {
    value: 'managing_editor',
    label: 'Managing editor',
    description: 'Everything an editor can do, across the whole newsroom.',
  },
  {
    value: 'subscription_manager',
    label: 'Subscription manager',
    description: 'Subscriptions, plans, invoices and B2B licences. No editorial access.',
  },
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]['value'];
