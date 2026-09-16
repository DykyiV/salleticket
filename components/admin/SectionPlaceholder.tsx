import Link from "next/link";
import Header from "@/components/Header";

export type PlannedFeature = {
  text: string;
  done?: boolean;
  href?: string;
};

/**
 * Shared layout for admin sections that are planned but not fully built yet:
 * shows what already works (with links) and what is planned, so the menu
 * structure is complete while features land incrementally.
 */
export default function SectionPlaceholder({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: PlannedFeature[];
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            ← Admin console
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {features.map((f) => (
              <li
                key={f.text}
                className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200"
              >
                <span aria-hidden="true">{f.done ? "✅" : "⬜"}</span>
                <span className={f.done ? "text-slate-800" : "text-slate-500"}>
                  {f.text}
                  {f.href ? (
                    <>
                      {" "}
                      <Link
                        href={f.href}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        Відкрити →
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
