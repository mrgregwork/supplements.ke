import { Resend } from "resend";
import { renderOtpEmailHtml, renderOrderConfirmationEmailHtml, type OrderConfirmationItem } from "../src/lib/emailTemplate";

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

const FROM_ADDRESS = "Supplements Kenya <noreply@supplements.ke>";

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Your Supplements Kenya Login Code",
    html: renderOtpEmailHtml(code),
    text: `Your Supplements Kenya login code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
  });

  if (error) {
    throw new Error(`Resend email error: ${error.message}`);
  }
}

export async function sendOrderConfirmationEmail(params: {
  to: string;
  orderNumber: string;
  currency: string;
  total: number;
  items: OrderConfirmationItem[];
  paymentMethod: string | null;
  mpesaReceiptNumber: string | null;
  cardReference: string | null;
}): Promise<void> {
  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Order confirmed - ${params.orderNumber}`,
    html: renderOrderConfirmationEmailHtml(params),
    text: `Thanks for your order! Your payment has been confirmed.\n\nOrder number: ${params.orderNumber}\nTotal: ${params.currency} ${params.total.toLocaleString()}`,
  });

  if (error) {
    throw new Error(`Resend email error: ${error.message}`);
  }
}
