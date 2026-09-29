import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const TEST_DB = "/tmp/asol-test.db";

export default function setup() {
  rmSync(TEST_DB, { force: true });
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    stdio: "pipe",
  });
  return () => {
    rmSync(TEST_DB, { force: true });
  };
}
