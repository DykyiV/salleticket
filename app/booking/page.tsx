import Header from "@/components/Header";
import BookingFlow from "@/components/BookingFlow";
import { getCurrentUser } from "@/lib/auth/session";
import { getSeatLayout } from "@/lib/seats";

export const dynamic = "force-dynamic";

type SearchParams = {
  carrier?: string;
  carrierId?: string;
  tripId?: string;
  from?: string;
  to?: string;
  date?: string;
  departure?: string;
  arrival?: string;
  duration?: string;
  price?: string;
};

export default async function BookingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();

  const carrier = searchParams.carrier || "Grandes Tour";
  const from = searchParams.from || "Kyiv";
  const to = searchParams.to || "Lviv";
  const date = searchParams.date;
  const departure = searchParams.departure || "08:00";
  const arrival = searchParams.arrival || "14:50";
  const duration = searchParams.duration
    ? Number.parseInt(searchParams.duration, 10)
    : 410;
  const price = searchParams.price
    ? Number.parseFloat(searchParams.price)
    : 22.0;

  const serviceFee = 1.5;
  const total = price + serviceFee;
  const tripId = searchParams.tripId ?? "unknown";
  const seatLayout = getSeatLayout(tripId);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <BookingFlow
        tripSummary={{
          carrier,
          carrierId: searchParams.carrierId ?? "mock",
          tripId: searchParams.tripId,
          from,
          to,
          date,
          departure,
          arrival,
          duration,
          price,
          total,
        }}
        currentUser={
          user ? { id: user.id, email: user.email, role: user.role } : null
        }
        seatLayout={seatLayout}
      />

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Asol BUS. Demo booking — no real payment.
        </div>
      </footer>
    </div>
  );
}
