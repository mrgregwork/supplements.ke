import nodemailer from "nodemailer";

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Supplements Kenya" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject: "Your Supplements Kenya Login Code",
    text: `Your one-time login code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
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
  });
}
