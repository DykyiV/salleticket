/**
 * Create (or reset) the first SUPER_ADMIN on a live database — the demo seed
 * refuses to run in production.
 *
 *   npm run admin:create -- --email owner@company.ua
 *     → asks for the password (not echoed); or pass ADMIN_PASSWORD in env.
 *
 * An existing account with that e-mail is promoted and gets the new password;
 * all its sessions are signed out. The action is written to the audit log.
 */
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = process.stdout.write.bind(process.stdout);
  let muted = false;
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) =>
    muted ? true : out(s);
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      muted = false;
      (process.stdout as unknown as { write: typeof out }).write = out;
      out("\n");
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Вкажіть e-mail: npm run admin:create -- --email you@company.ua");
  }
  const password = process.env.ADMIN_PASSWORD ?? (await askHidden("Пароль (мін. 12 символів): "));
  if (password.length < 12) throw new Error("Пароль має містити щонайменше 12 символів");
  if (password.length > 72) throw new Error("Пароль довший за 72 байти");

  const hash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, password: hash, role: "SUPER_ADMIN" },
    update: { password: hash, role: "SUPER_ADMIN", sessionVersion: { increment: 1 } },
  });
  await prisma.auditLog.create({
    data: {
      action: "admin.create",
      targetType: "user",
      targetId: user.id,
      changes: JSON.stringify({ email, role: { from: null, to: "SUPER_ADMIN" } }),
    },
  });
  console.log(`SUPER_ADMIN ready: ${email}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
