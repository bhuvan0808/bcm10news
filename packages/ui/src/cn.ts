import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names, letting a later Tailwind utility win over an earlier one
 * in the same group. Without this, a `className` prop cannot override a
 * component's own padding — the two classes both land in the stylesheet and
 * source order decides, which is not what the caller meant.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
