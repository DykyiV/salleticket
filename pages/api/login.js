import { issueJwt, sessionCookie } from "../../lib/auth";

const DEMO_USER = {
  id: "user-demo-1",
  email: "demo@asol.bus",
  role: "AGENT",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body || {};
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = { ...DEMO_USER, email: normalized };
  const token = issueJwt(user);
  res.setHeader("Set-Cookie", sessionCookie(token));

  return res.status(200).json({ user });
}
