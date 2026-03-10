import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Removes Vietnamese tone marks/accents and converts to base Latin alphabet.
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFC");
}

/**
 * Sanitizes strings for system storage and CSV compatibility.
 * Removes Vietnamese accents and replaces commas with hyphens.
 */
export function sanitizeDataForSystem(str: any): string {
  if (str === null || str === undefined) return '';
  let val = str.toString();
  // 1. Remove Vietnamese accents
  val = removeVietnameseTones(val);
  // 2. Replace commas with hyphens to prevent CSV column breaking
  val = val.replace(/,/g, '-');
  // 3. Replace multiple spaces with single space and trim
  return val.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes a string by removing accents, whitespace, and converting to lowercase.
 * Used for robust matching of names, destinations, etc.
 */
export function normalizeString(s: any): string {
  if (s === null || s === undefined) return '';
  const accentFree = removeVietnameseTones(s.toString());
  return accentFree.replace(/\s+/g, '').toLowerCase();
}
