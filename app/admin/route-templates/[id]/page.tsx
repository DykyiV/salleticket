import { redirect } from "next/navigation";

export default async function Redirect(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/cabinet/routes/${params.id}`);
}
