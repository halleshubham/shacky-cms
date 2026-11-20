// Postgres LIKE/ILIKE treats `%` and `_` as wildcards and `\` as its escape
// character, even when the value arrives as a bound parameter — Prisma's
// `contains` wraps the value in '%...%' but does not escape wildcard
// characters that are already part of the user's search term. Without this,
// searching for e.g. "50%" or "track_record" silently turns into a much
// broader pattern match than the user typed.
export function escapeLikeWildcards(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
