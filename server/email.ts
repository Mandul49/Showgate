import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Showgate <support@showgate.ng>";

export interface ConfirmationEmailOptions {
  to: string;
  buyerName: string;
  eventTitle: string;
  eventDate?: string;
  eventLocation?: string;
  ticketTypeName: string;
  quantity: number;
  amount: number;
  reference: string;
  brandName?: string;
  brandLogoUrl?: string | null;
  isPro?: boolean;
  isBankTransfer?: boolean;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  label: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] ${opts.label} NOT sent to ${opts.to}: RESEND_API_KEY not configured.`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
    console.log(`[email] ${opts.label} sent to ${opts.to}`);
  } catch (err: any) {
    console.error(`[email] ${opts.label} failed for ${opts.to}:`, err.message ?? JSON.stringify(err));
  }
}

export async function sendVerificationEmail(opts: { to: string; verifyUrl: string }): Promise<void> {
  await sendEmail({
    to: opts.to,
    subject: "Confirm your Showgate email address",
    label: "Verification email",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#111;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px 28px;">
          <span style="font-size:18px;font-weight:900;color:#000;">Showgate</span>
          <h1 style="margin:8px 0 0;font-size:20px;color:#000;font-weight:900;">Confirm your email</h1>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 16px;color:#a1a1aa;">Welcome to Showgate! Click the button below to verify your email address and activate your account.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="${opts.verifyUrl}" style="display:inline-block;background:#f59e0b;color:#000;font-weight:900;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">Verify Email</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#71717a;">Or copy this link: <span style="word-break:break-all;color:#f59e0b;">${opts.verifyUrl}</span></p>
          <p style="margin:24px 0 0;font-size:12px;color:#52525b;">If you didn't create a Showgate account, you can safely ignore this email.</p>
        </div>
      </div>`,
  });
}

export async function sendPasswordResetEmail(opts: { to: string; resetUrl: string }): Promise<void> {
  await sendEmail({
    to: opts.to,
    subject: "Reset your Showgate password",
    label: "Password reset email",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#111;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px 28px;">
          <span style="font-size:18px;font-weight:900;color:#000;">Showgate</span>
          <h1 style="margin:8px 0 0;font-size:20px;color:#000;font-weight:900;">Reset your password</h1>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 16px;color:#a1a1aa;">We received a request to reset your Showgate password. Click the button below to choose a new one — the link expires in 1 hour.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="${opts.resetUrl}" style="display:inline-block;background:#f59e0b;color:#000;font-weight:900;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">Reset Password</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#71717a;">Or copy this link: <span style="word-break:break-all;color:#f59e0b;">${opts.resetUrl}</span></p>
          <p style="margin:24px 0 0;font-size:12px;color:#52525b;">Didn't request this? You can safely ignore this email — your password won't change.</p>
        </div>
      </div>`,
  });
}

export async function sendAdminInviteEmail(opts: { to: string; setPasswordUrl: string; invitedBy: string; role: string }): Promise<void> {
  const roleLabel: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    support: "Support",
    finance: "Finance",
  };
  await sendEmail({
    to: opts.to,
    subject: "You've been invited to join Showgate as an admin",
    label: "Admin invite email",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#111;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px 28px;">
          <span style="font-size:18px;font-weight:900;color:#000;">Showgate</span>
          <h1 style="margin:8px 0 0;font-size:20px;color:#000;font-weight:900;">You're invited to join the team</h1>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 16px;color:#a1a1aa;">${opts.invitedBy} has added you to Showgate as <strong style="color:#f59e0b;">${roleLabel[opts.role] ?? opts.role}</strong>. Set a password to activate your account and access the admin panel.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="${opts.setPasswordUrl}" style="display:inline-block;background:#f59e0b;color:#000;font-weight:900;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">Set Your Password</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#71717a;">Or copy this link: <span style="word-break:break-all;color:#f59e0b;">${opts.setPasswordUrl}</span></p>
          <p style="margin:24px 0 0;font-size:12px;color:#52525b;">This link expires in 48 hours. If you weren't expecting this invitation, you can safely ignore this email.</p>
        </div>
      </div>`,
  });
}

export async function sendTestEmail(to: string): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, detail: "RESEND_API_KEY not configured" };
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Showgate — test email",
      html: `<p style="font-family:sans-serif;">This is a test email from Showgate. If you received this, the email service is working correctly.</p>`,
    });
    return { ok: true, detail: "Resend: message queued" };
  } catch (err: any) {
    return { ok: false, detail: err.message ?? JSON.stringify(err) };
  }
}

export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] sendWelcomeEmail skipped: RESEND_API_KEY not configured");
    return;
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Welcome to Showgate 🎉",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#111;color:#f5f5f5;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px 28px;">
            <span style="font-size:18px;font-weight:900;color:#000;">Showgate</span>
            <h1 style="margin:8px 0 0;font-size:22px;color:#000;font-weight:900;">Welcome, ${firstName}! 🎉</h1>
          </div>
          <div style="padding:24px 28px;">
            <p style="margin:0 0 16px;color:#a1a1aa;font-size:15px;">
              You're now on <strong style="color:#fff;">Showgate</strong> — Nigeria's event ticketing platform built for the people who make things happen.
            </p>
            <p style="margin:0 0 16px;color:#a1a1aa;font-size:15px;">
              Create your first event, set your ticket prices, and get paid directly to your account via Paystack — all in under five minutes.
            </p>
            <p style="margin:24px 0;text-align:center;">
              <a href="https://showgate.ng" style="display:inline-block;background:#f59e0b;color:#000;font-weight:900;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;">Get Started →</a>
            </p>
            <p style="margin:24px 0 0;font-size:12px;color:#52525b;border-top:1px solid #27272a;padding-top:16px;">
              Questions? Reply to this email or contact us at
              <a href="mailto:support@showgate.ng" style="color:#f59e0b;text-decoration:none;">support@showgate.ng</a>
            </p>
          </div>
        </div>`,
    });
    console.log(`[email] Welcome email sent to ${to}`);
  } catch (err: any) {
    console.error(`[email] Welcome email failed for ${to}:`, err.message ?? JSON.stringify(err));
    throw err;
  }
}

export async function sendConfirmationEmail(opts: ConfirmationEmailOptions): Promise<void> {
  const brandName = opts.brandName || "Showgate";
  const isPro = opts.isPro ?? false;
  const logoHtml = (isPro && opts.brandLogoUrl)
    ? `<img src="${opts.brandLogoUrl}" alt="${brandName}" style="height:36px;max-width:160px;object-fit:contain;display:block;margin-bottom:10px;" />`
    : `<span style="font-size:18px;font-weight:900;color:#000;">${brandName}</span>`;

  const poweredBy = isPro
    ? ""
    : `<p style="margin:24px 0 0;font-size:12px;color:#52525b;">Show this reference at the gate. Powered by Showgate.</p>`;

  const eventDateRow = opts.eventDate
    ? `<tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:13px;">Date</td><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-weight:600;text-align:right;">${opts.eventDate}</td></tr>`
    : "";

  const eventLocationRow = opts.eventLocation
    ? `<tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:13px;">Location</td><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-weight:600;text-align:right;">${opts.eventLocation}</td></tr>`
    : "";

  const bankDetailsHtml = opts.isBankTransfer
    ? `<div style="margin-top:24px;padding:16px;background:#1a1a2e;border:1px solid #3f3f46;border-radius:8px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.05em;">Bank Transfer Details</p>
        <p style="margin:0 0 6px;font-size:13px;color:#a1a1aa;">Please transfer <strong style="color:#f59e0b;">₦${opts.amount.toLocaleString()}</strong> to the account below and use your order reference as the payment description.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          ${opts.bankName ? `<tr><td style="padding:6px 0;color:#71717a;font-size:13px;">Bank</td><td style="padding:6px 0;color:#fff;font-weight:600;text-align:right;">${opts.bankName}</td></tr>` : ""}
          ${opts.accountName ? `<tr><td style="padding:6px 0;color:#71717a;font-size:13px;">Account Name</td><td style="padding:6px 0;color:#fff;font-weight:600;text-align:right;">${opts.accountName}</td></tr>` : ""}
          ${opts.accountNumber ? `<tr><td style="padding:6px 0;color:#71717a;font-size:13px;">Account Number</td><td style="padding:6px 0;color:#fff;font-weight:600;text-align:right;font-family:monospace;">${opts.accountNumber}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#71717a;font-size:13px;">Reference</td><td style="padding:6px 0;color:#fff;font-family:monospace;text-align:right;">${opts.reference.toUpperCase()}</td></tr>
        </table>
        <p style="margin:12px 0 0;font-size:12px;color:#71717a;">Your ticket will be confirmed once we receive your payment. Keep this email as your receipt.</p>
      </div>`
    : "";

  const statusLabel = opts.isBankTransfer ? "Awaiting Payment" : "Confirmed";
  const statusColor = opts.isBankTransfer ? "#f59e0b" : "#22c55e";
  const headerTitle = opts.isBankTransfer
    ? `Bank transfer details for ${opts.buyerName.split(" ")[0]} 🏦`
    : `You're in, ${opts.buyerName.split(" ")[0]}! 🎉`;

  await sendEmail({
    to: opts.to,
    subject: opts.isBankTransfer
      ? `🏦 Bank transfer details for ${opts.eventTitle}`
      : `✅ Your ticket for ${opts.eventTitle} is confirmed`,
    label: "Confirmation email",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#111;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;">
          ${logoHtml}
          <h1 style="margin:0;font-size:22px;color:#000;font-weight:900;">${headerTitle}</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="margin:0 0 20px;color:#a1a1aa;">Your order for <strong style="color:#fff">${opts.eventTitle}</strong> has been received.</p>
          <table style="width:100%;border-collapse:collapse;">
            ${eventDateRow}
            ${eventLocationRow}
            <tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:13px;">Ticket</td><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-weight:600;text-align:right;">${opts.ticketTypeName}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:13px;">Qty</td><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-weight:600;text-align:right;">${opts.quantity}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:13px;">Amount</td><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#f59e0b;font-weight:900;text-align:right;">₦${opts.amount.toLocaleString()}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:13px;">Reference</td><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-family:monospace;text-align:right;">${opts.reference.toUpperCase()}</td></tr>
            <tr><td style="padding:10px 0;color:#71717a;font-size:13px;">Status</td><td style="padding:10px 0;font-weight:700;text-align:right;color:${statusColor};">${statusLabel}</td></tr>
          </table>
          ${bankDetailsHtml}
          ${poweredBy}
        </div>
      </div>`,
  });
}
