import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeArabic(text: string, strict = false) {
  let normalized = text
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/ال/g, '')
    .trim()
    .toLowerCase();

  if (strict) {
    normalized = normalized.replace(/\s+/g, ''); // remove all spaces for strict comparison
  }
  return normalized;
}
