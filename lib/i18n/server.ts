import { cookies, headers } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, isLang, langFromAcceptLanguage, type Lang } from "@/lib/i18n/config";
import { dictionaries, type Dict } from "@/lib/i18n/dict";

/** Language of the current request: the visitor's choice, else the browser's. */
export async function getLang(): Promise<Lang> {
  try {
    const chosen = (await cookies()).get(LANG_COOKIE)?.value;
    if (isLang(chosen)) return chosen;
    return langFromAcceptLanguage((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LANG;
  }
}

export async function getDict(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: dictionaries[lang] };
}
