import { Resend } from "resend";

// Lazy init so build doesn't fail when RESEND_API_KEY isn't set
let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY environment variable is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Camp Manager <onboarding@resend.dev>";
