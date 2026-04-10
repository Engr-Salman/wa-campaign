import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Loose but safe email regex. Real validation happens via
// normalizeEmail + MX checks on the server for imports.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function formatPercent(n: number, total: number, digits = 1): string {
  if (!total) return "0%";
  return `${((n / total) * 100).toFixed(digits)}%`;
}

export function pluralize(n: number, one: string, many?: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many ?? one + "s"}`;
}
