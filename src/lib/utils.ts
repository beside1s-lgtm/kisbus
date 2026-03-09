import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a string by removing all whitespace and converting to lowercase.
 * Used for robust matching of names, destinations, etc.
 */
export function normalizeString(s: any): string {
  if (s === null || s === undefined) return '';
  return s.toString().replace(/\s+/g, '').toLowerCase();
}
