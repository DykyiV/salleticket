import { redirect } from "next/navigation";

export default function Redirect({
  searchParams,
}: {
  searchParams?: Record<string, string | undefined>;
}) {
  const q = new URLSearchParams();
  if (searchParams?.templateId) q.set("templateId", searchParams.templateId);
  if (searchParams?.from) q.set("from", searchParams.from);
  if (searchParams?.to) q.set("to", searchParams.to);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/cabinet/departures${suffix}`);
}
