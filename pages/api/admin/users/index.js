import { listUsers } from "../../../../lib/users-store";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const role =
    typeof req.query.role === "string" ? req.query.role.trim().toUpperCase() : "";
  const items =
    role === "AGENT" ? listUsers().filter((user) => user.role === "AGENT") : listUsers();

  return res.status(200).json({ items });
}
