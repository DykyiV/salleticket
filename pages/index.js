import { useEffect, useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("");

  const loadMe = async () => {
    const res = await fetch("/api/me", {
      method: "GET",
      credentials: "include",
    });
    const data = await res.json();
    setUser(data.user ?? null);
  };

  useEffect(() => {
    void loadMe();
  }, []);

  const login = async () => {
    setStatus("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error ?? "Login failed");
      return;
    }
    setStatus("Logged in");
    await loadMe();
  };

  const logout = async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
    setStatus("Logged out");
    await loadMe();
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Asol BUS</h1>
      <h2>Продаж квитків онлайн</h2>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={login}>Login</button>
        <button onClick={logout}>Logout</button>
      </div>

      <p style={{ marginTop: 10 }}>Auth status: {user ? user.email : "guest"}</p>
      {status ? <p>{status}</p> : null}

      <div style={{ marginTop: 20 }}>
        <input placeholder="Звідки" />
        <input placeholder="Куди" style={{ marginLeft: 10 }} />
        <input type="date" style={{ marginLeft: 10 }} />
        <button style={{ marginLeft: 10 }}>Знайти рейс</button>
      </div>

      <div style={{ marginTop: 20 }}>
        <a href="/booking">Go to booking page</a>
      </div>
    </div>
  );
}
