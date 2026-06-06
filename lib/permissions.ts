import type { UserRole } from "@/types/business";

export function canEdit(role: UserRole): boolean {
  return role === "ADMIN" || role === "STAFF";
}

export function canManageSettings(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canOverrideInvoiceCost(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canViewReports(role: UserRole): boolean {
  return role === "ADMIN" || role === "STAFF" || role === "VIEWER";
}
