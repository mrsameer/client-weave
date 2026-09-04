/** Remove credentials and direct contact identifiers before public serialization. */
export function redactPublicText(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/(token|secret|authorization|cookie)\s*[:=]\s*(?:Bearer\s+)?\S+/gi, "$1=[redacted]");
}
