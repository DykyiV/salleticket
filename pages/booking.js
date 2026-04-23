import { useEffect, useState } from "react";

export default function BookingPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadMe = async () => {
      try {
        const res = await fetch("/api/me", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (active) setUser(data.user ?? null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadMe();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Booking</h1>
      {loading ? <p>Checking session...</p> : null}
      {!loading && user ? (
        <p>Signed in as {user.email}. You can continue booking.</p>
      ) : null}
      {!loading && !user ? (
        <p>You are browsing as guest. You can still stay on this page.</p>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <input placeholder="Passenger name" />
        <input placeholder="Phone" style={{ marginLeft: 10 }} />
        <button style={{ marginLeft: 10 }}>Confirm</button>
      </div>
    </div>
  );
}
