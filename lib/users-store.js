import fs from "fs";
import path from "path";
import crypto from "crypto";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "users.json");
const ROLES = ["USER", "AGENT", "ADMIN", "SUPER_ADMIN"];

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedUsers(), null, 2), "utf8");
  }
}

function seedUsers() {
  const now = Date.now();
  const users = [];

  users.push({
    id: "admin-1",
    email: "admin@asol.bus",
    role: "ADMIN",
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 30).toISOString(),
  });

  users.push({
    id: "agent-1",
    email: "agent1@asol.bus",
    role: "AGENT",
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 20).toISOString(),
  });

  for (let i = 1; i <= 24; i += 1) {
    users.push({
      id: `user-demo-${i}`,
      email: `user${i}@asol.bus`,
      role: "USER",
      createdAt: new Date(now - i * 1000 * 60 * 60 * 6).toISOString(),
    });
  }

  return users;
}

function readUsers() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeUsers(users) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), "utf8");
}

export function listUsers() {
  return readUsers().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listAgents() {
  return listUsers().filter((user) => user.role === "AGENT");
}

export function listUsersByRole(role) {
  if (!role) return [];
  const normalized = String(role).trim().toUpperCase();
  return listUsers().filter((user) => user.role === normalized);
}

export function getUserById(userId) {
  if (!userId) return null;
  return readUsers().find((user) => user.id === userId) ?? null;
}

export function getUserByEmail(email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  return readUsers().find((user) => user.email === normalized) ?? null;
}

export function normalizeUserInput(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = {};

  if (Object.prototype.hasOwnProperty.call(src, "email")) {
    out.email = typeof src.email === "string" ? src.email.trim().toLowerCase() : "";
  }
  if (Object.prototype.hasOwnProperty.call(src, "role")) {
    out.role = typeof src.role === "string" ? src.role.trim().toUpperCase() : "";
  }

  return out;
}

export function createUser(input) {
  const users = readUsers();
  const now = new Date().toISOString();
  const row = {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    email: input.email,
    role: input.role,
    createdAt: now,
  };
  users.push(row);
  writeUsers(users);
  return row;
}

export function roleExists(role) {
  return ROLES.includes(role);
}
