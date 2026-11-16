import { getSiteContacts } from "@/lib/siteContacts";
import type { LegalContacts } from "@/lib/legal/texts";

/** E-mail and phones from Settings → «Контакти на сайті», as on the rest of the site. */
export async function legalContacts(): Promise<LegalContacts> {
  const c = await getSiteContacts();
  return { email: c.email, phones: [c.phoneDe, c.phoneEs, c.phoneUa].filter(Boolean) };
}
