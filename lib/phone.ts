// Full metadata ("max"): Grandes Tour checks numbers that strictly, too.
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * A real phone number in E.164 ("+380501234567"), as Grandes Tour requires;
 * null when the number is not valid. "00…" counts as "+…"; numbers without
 * a country code are read as Ukrainian.
 */
export function toE164(raw: string): string | null {
  const value = raw.trim().replace(/^00/, "+");
  const phone = parsePhoneNumberFromString(value, "UA");
  return phone && phone.isValid() ? phone.number : null;
}
