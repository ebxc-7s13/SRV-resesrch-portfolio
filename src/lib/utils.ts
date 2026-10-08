/**
 * Minimal className joiner for shadcn-style `cn()` imports.
 * No external dependencies (clsx / tailwind-merge are not installed).
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
