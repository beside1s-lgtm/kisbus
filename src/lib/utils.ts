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
 * This ensures consistency in the database and prevents CSV structure breaking.
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
 * Normalizes a string for robust comparison/matching.
 * Removes accents, treats commas and hyphens as the same, 
 * removes all whitespace, and converts to lowercase.
 */
export function normalizeString(s: any): string {
  if (s === null || s === undefined) return '';
  let val = s.toString();
  // 1. Remove Vietnamese accents
  val = removeVietnameseTones(val);
  // 2. Treat commas and hyphens as identical for matching purposes
  val = val.replace(/,/g, '-');
  // 3. Remove all whitespace and convert to lowercase
  return val.replace(/\s+/g, '').toLowerCase();
}
