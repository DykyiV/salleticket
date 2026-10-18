import { describe, expect, it } from "vitest";
import { assertProductionSecrets, productionSecretProblem } from "@/lib/security/secrets";
import { onlinePaymentMode } from "@/lib/paymentMode";
import { userChangeRefusal } from "@/lib/auth/userAdmin";

describe("production secrets", () => {
  it("rejects missing, example and short secrets", () => {
    expect(productionSecretProblem("JWT_SECRET", undefined)).toMatch(/not set/);
    expect(productionSecretProblem("JWT_SECRET", "super-secret-key-12345")).toMatch(/example/);
    expect(productionSecretProblem("CRON_SECRET", "change-me-cron-secret")).toMatch(/example/);
    expect(productionSecretProblem("JWT_SECRET", "a".repeat(31))).toMatch(/shorter than 32/);
    expect(productionSecretProblem("JWT_SECRET", "x".repeat(48))).toBeNull();
  });

  it("start-up check lists every problem; CRON_SECRET may be absent", () => {
    expect(() => assertProductionSecrets({ NODE_ENV: "production", JWT_SECRET: "super-secret-key-12345", CRON_SECRET: "change-me-cron-secret" })).toThrow(
      /JWT_SECRET uses the public example value; CRON_SECRET uses the public example value/
    );
    expect(() => assertProductionSecrets({ NODE_ENV: "production", JWT_SECRET: "k".repeat(40) })).not.toThrow();
  });
});

describe("online payment mode", () => {
  it("test payments only in development unless explicitly allowed on a closed server", () => {
    expect(onlinePaymentMode({ NODE_ENV: "development" })).toBe("mock");
    expect(onlinePaymentMode({ NODE_ENV: "production" })).toBe("disabled");
    expect(onlinePaymentMode({ NODE_ENV: "production", PAYMENT_PROVIDER: "mock" })).toBe("disabled");
    expect(onlinePaymentMode({ NODE_ENV: "production", PAYMENT_PROVIDER: "mock", ALLOW_MOCK_PAYMENTS: "1" })).toBe("mock");
    expect(onlinePaymentMode({ NODE_ENV: "production", PAYMENT_PROVIDER: "monobank" })).toBe("disabled");
  });
});

describe("who may manage whom", () => {
  const admin = { id: "a", role: "ADMIN" as const };
  const sup = { id: "s", role: "SUPER_ADMIN" as const };
  it("nobody edits themselves", () => {
    expect(userChangeRefusal({ actor: admin, target: admin, newRole: "CUSTOMER", superAdminCount: 1 })).toMatch(/власну/);
  });
  it("an ADMIN cannot touch ADMIN / SUPER_ADMIN accounts or grant those roles", () => {
    expect(userChangeRefusal({ actor: admin, target: { id: "s", role: "SUPER_ADMIN" }, newRole: "CUSTOMER", superAdminCount: 2 })).toMatch(/нижчою роллю/);
    expect(userChangeRefusal({ actor: admin, target: { id: "b", role: "ADMIN" }, superAdminCount: 1 })).toMatch(/нижчою роллю/);
    expect(userChangeRefusal({ actor: admin, target: { id: "c", role: "AGENT" }, newRole: "ADMIN", superAdminCount: 1 })).toMatch(/нижчі за власну/);
    expect(userChangeRefusal({ actor: admin, target: { id: "c", role: "AGENT" }, newRole: "MANAGER", superAdminCount: 1 })).toBeNull();
  });
  it("a SUPER_ADMIN manages admins but never demotes the last super-admin", () => {
    expect(userChangeRefusal({ actor: sup, target: { id: "b", role: "ADMIN" }, newRole: "AGENT", superAdminCount: 1 })).toBeNull();
    expect(userChangeRefusal({ actor: sup, target: { id: "s2", role: "SUPER_ADMIN" }, newRole: "ADMIN", superAdminCount: 2 })).toBeNull();
    expect(userChangeRefusal({ actor: sup, target: { id: "s2", role: "SUPER_ADMIN" }, newRole: "ADMIN", superAdminCount: 1 })).toMatch(/останнього/);
  });
});
