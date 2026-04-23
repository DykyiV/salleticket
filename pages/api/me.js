import { getSessionFromRequest } from "../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = getSessionFromRequest(req);
  return res.status(200).json({ user });
}
