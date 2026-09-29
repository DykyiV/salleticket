import { redirect } from "next/navigation";

export default async function Redirect(
  props: {
    searchParams?: Promise<Record<string, string | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const q = new URLSearchParams();
  if (searchParams?.templateId) q.set("templateId", searchParams.templateId);
  if (searchParams?.from) q.set("from", searchParams.from);
  if (searchParams?.to) q.set("to", searchParams.to);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/cabinet/departures${suffix}`);
}
