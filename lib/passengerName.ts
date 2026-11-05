/**
 * Passenger names as Grandes Tour accepts them: Latin letters (as in the
 * passport), spaces and hyphens inside, at least 3 characters.
 */
const LATIN_NAME = /^\s*[a-zA-Z][a-zA-Z -]+[a-zA-Z]\s*$/;

export function isLatinName(value: string): boolean {
  return LATIN_NAME.test(value);
}
