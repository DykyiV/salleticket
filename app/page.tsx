import Header from "@/components/Header";
import SearchForm from "@/components/SearchForm";

const FEATURES = [
  {
    title: "Best prices",
    description:
      "Compare carriers and fare classes to find the most affordable ride.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
        <line x1="7" x2="7.01" y1="7" y2="7" />
      </svg>
    ),
  },
  {
    title: "Instant booking",
    description:
      "Reserve your seat in seconds and receive tickets right to your email.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    title: "Trusted carriers",
    description:
      "Hundreds of verified operators with real reviews and ratings.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

const STATS = [
  { label: "Routes", value: "12k+" },
  { label: "Cities", value: "2 300" },
  { label: "Carriers", value: "480" },
  { label: "Tickets sold", value: "1.2M" },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500" />
          <div
            className="absolute inset-0 -z-10 opacity-30 [mask-image:radial-gradient(circle_at_top,white,transparent_70%)]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.25) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:px-8">
            <div className="mx-auto max-w-3xl text-center text-white">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Bus ticket marketplace
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Travel between cities the <span className="text-brand-100">smart way</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base text-brand-50/90 sm:text-lg">
                Compare routes, carriers, and prices — and book your next bus
                trip in a couple of clicks. No hidden fees, no paperwork.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-5xl">
              <SearchForm />
            </div>

            <dl className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-white/10 p-4 text-center text-white ring-1 ring-inset ring-white/15 backdrop-blur"
                >
                  <dt className="text-xs uppercase tracking-wide text-brand-100/80">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why Asol BUS
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Everything you need for a comfortable journey — in one marketplace.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition group-hover:bg-brand-600 group-hover:text-white">
                  {feature.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Asol BUS. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-slate-900">
              Terms
            </a>
            <a href="#" className="hover:text-slate-900">
              Privacy
            </a>
            <a href="#" className="hover:text-slate-900">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
