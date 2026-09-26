/**
 * SMS sending adapter.
 *
 * Currently a MOCK: messages are logged server-side and a fake provider id is
 * returned, so the whole flow (bulk send, per-ticket audit) can be exercised
 * end-to-end without a paid SMS gateway. To go live, set SMS_PROVIDER and the
 * provider credentials and implement the branch below (e.g. Twilio, TurboSMS,
 * Twilio Verify etc.) — the call sites do not change.
 */

export type SmsSendResult = {
  ok: boolean;
  provider: string;
  providerMessageId: string;
  error?: string;
};

export async function sendSms(
  phone: string,
  message: string
): Promise<SmsSendResult> {
  const provider = process.env.SMS_PROVIDER ?? "mock";

  if (provider === "mock") {
    const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[sms:mock] → ${phone}: ${message} (id ${id})`);
    return { ok: true, provider, providerMessageId: id };
  }

  // Real providers plug in here.
  return {
    ok: false,
    provider,
    providerMessageId: "",
    error: `SMS provider "${provider}" is not implemented yet`,
  };
}
