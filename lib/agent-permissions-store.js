import fs from "fs";
import path from "path";
import crypto from "crypto";

export const COMMISSION_TYPES = ["FIXED", "PERCENT"];

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "agent-permissions.json");

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

function readPermissions() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writePermissions(items) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), "utf8");
}

function makeId() {
  return `AP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function normalizeAgentPermissionInput(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = {};

  if (Object.prototype.hasOwnProperty.call(src, "userId")) {
    out.userId = typeof src.userId === "string" ? src.userId.trim() : "";
  }
  if (Object.prototype.hasOwnProperty.call(src, "canEditName")) {
    out.canEditName = Boolean(src.canEditName);
  }
  if (Object.prototype.hasOwnProperty.call(src, "canViewAllTickets")) {
    out.canViewAllTickets = Boolean(src.canViewAllTickets);
  }
  if (Object.prototype.hasOwnProperty.call(src, "canViewSpecificUsers")) {
    out.canViewSpecificUsers = Boolean(src.canViewSpecificUsers);
  }
  if (Object.prototype.hasOwnProperty.call(src, "canMarkCashPaid")) {
    out.canMarkCashPaid = Boolean(src.canMarkCashPaid);
  }
  if (Object.prototype.hasOwnProperty.call(src, "commissionType")) {
    const v = typeof src.commissionType === "string" ? src.commissionType.trim().toUpperCase() : "";
    out.commissionType = v;
  }
  if (Object.prototype.hasOwnProperty.call(src, "commissionValue")) {
    out.commissionValue =
      typeof src.commissionValue === "number"
        ? src.commissionValue
        : Number.parseFloat(String(src.commissionValue));
  }

  return out;
}

export function normalizeAgentPermissionPatch(input) {
  return normalizeAgentPermissionInput(input);
}

export function validateAgentPermission(input, { partial = false } = {}) {
  const errors = [];
  const required = [
    "userId",
    "canEditName",
    "canViewAllTickets",
    "canViewSpecificUsers",
    "canMarkCashPaid",
    "commissionType",
    "commissionValue",
  ];

  if (!partial) {
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) {
        errors.push(`${key} is required`);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "userId") && !input.userId) {
    errors.push("userId must be a non-empty string");
  }
  if (
    Object.prototype.hasOwnProperty.call(input, "commissionType") &&
    !COMMISSION_TYPES.includes(input.commissionType)
  ) {
    errors.push("commissionType must be FIXED or PERCENT");
  }
  if (
    Object.prototype.hasOwnProperty.call(input, "commissionValue") &&
    (!Number.isFinite(input.commissionValue) || input.commissionValue < 0)
  ) {
    errors.push("commissionValue must be a number >= 0");
  }

  return errors;
}

export function listAgentPermissions() {
  return readPermissions();
}

export function getAgentPermissionById(id) {
  return readPermissions().find((item) => item.id === id) ?? null;
}

export function getAgentPermissionByUserId(userId) {
  if (!userId) return null;
  return readPermissions().find((item) => item.userId === userId) ?? null;
}

export function getAgentPermissionForUser(userId) {
  return getAgentPermissionByUserId(userId);
}

export function hasAgentPermission(permission, key) {
  if (!permission || typeof permission !== "object") return false;
  return Boolean(permission[key]);
}

export function createAgentPermission(input) {
  const items = readPermissions();
  const now = new Date().toISOString();
  const row = {
    id: makeId(),
    userId: input.userId,
    canEditName: input.canEditName,
    canViewAllTickets: input.canViewAllTickets,
    canViewSpecificUsers: input.canViewSpecificUsers,
    canMarkCashPaid: input.canMarkCashPaid,
    commissionType: input.commissionType,
    commissionValue: input.commissionValue,
    createdAt: now,
    updatedAt: now,
  };
  items.push(row);
  writePermissions(items);
  return row;
}

export function updateAgentPermission(id, patch) {
  const items = readPermissions();
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const next = {
    ...items[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  items[idx] = next;
  writePermissions(items);
  return next;
}
