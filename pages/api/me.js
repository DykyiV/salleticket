import { getCurrentUserFromJwt } from "../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = getCurrentUserFromJwt(req);
  return res.status(200).json({ user });
}
