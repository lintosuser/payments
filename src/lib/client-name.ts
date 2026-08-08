// Either business_name OR (first_name + last_name) is required at the API
// level. This helper picks the right thing to display / pass to the payment
// provider's `contact` field.

export interface NamedClient {
  business_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

/** Primary display name: business name if set, otherwise full personal name. */
export function clientDisplayName(c: NamedClient | null | undefined): string {
  if (!c) return "";
  if (c.business_name && c.business_name.trim()) return c.business_name.trim();
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
}

/** True iff the client has at least one valid name (business or personal). */
export function hasValidName(c: NamedClient): boolean {
  const b = (c.business_name ?? "").trim();
  const f = (c.first_name ?? "").trim();
  const l = (c.last_name ?? "").trim();
  return Boolean(b || (f && l));
}
