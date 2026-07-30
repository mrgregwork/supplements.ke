import { Resend } from "resend";

// Resend's constructor throws when no API key is present. Building it at module
// scope meant a missing RESEND_API_KEY made this whole module fail to import,
// which in turn made every route importing it 404 — taking out OTP login
// entirely rather than just email delivery. Construct it lazily instead so a
// missing key surfaces as a handled send failure at the call site.
let resend: Resend | null = null;

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set — cannot send email.");
  }
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM_ADDRESS = "Supplements Kenya <noreply@supplements.co.ke>";

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Your Supplements Kenya Login Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="display: inline-block; background: #16a34a; color: #fff; font-weight: bold; font-size: 20px; padding: 8px 18px; border-radius: 8px; letter-spacing: 1px;">SK</span>
          <h2 style="margin: 16px 0 4px; color: #111;">Supplements Kenya</h2>
        </div>
        <p style="color: #444; font-size: 15px; margin-bottom: 8px;">Your one-time login code is:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; letter-spacing: 10px; font-size: 36px; font-weight: bold; font-family: monospace; color: #16a34a; background: #f0fdf4; padding: 16px 24px; border-radius: 10px; border: 2px solid #bbf7d0;">${code}</span>
        </div>
        <p style="color: #666; font-size: 13px; text-align: center;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">If you did not request this code, you can safely ignore this email.</p>
      </div>
    `,
    text: `Your Supplements Kenya login code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
  });

  if (error) {
    throw new Error(`Resend email error: ${error.message}`);
  }
}
