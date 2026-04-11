const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Email delivery
// ---------------------------------------------------------------------------
//
// Railway (and most cloud PaaS) blocks outbound SMTP on ports 25/465/587 as a
// spam-prevention policy, so Gmail SMTP via nodemailer will time out there no
// matter what we configure.  To keep email working in production we use
// **Resend** (https://resend.com) — an HTTP-based transactional email API that
// is not affected by SMTP blocks.
//
// Behavior:
//   - If RESEND_API_KEY is set, send via Resend's HTTPS API.
//   - Otherwise, fall back to Gmail SMTP via nodemailer (works locally and on
//     any host that allows outbound SMTP).
//
// Configure in Railway:
//   RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxxxx
//   EMAIL_FROM     = onboarding@resend.dev      (sandbox sender, no domain
//                                                verification required — good
//                                                for testing)
//   or EMAIL_FROM  = no-reply@your-verified-domain.com
// ---------------------------------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// `onboarding@resend.dev` is Resend's shared sandbox sender that works
// immediately after signup without any domain verification.  Swap it out for a
// sender on your own verified domain once you're ready.
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  (RESEND_API_KEY ? 'onboarding@resend.dev' : 'salman.ahm97@gmail.com');

const EMAIL_USER = process.env.EMAIL_USER || EMAIL_FROM;
// Gmail App Passwords are displayed with spaces (`xxxx xxxx xxxx xxxx`) but
// must be sent to SMTP without them.  Strip all whitespace just in case.
const EMAIL_APP_PASSWORD = (process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

// ---------------------------------------------------------------------------
// Resend (HTTP) transport
// ---------------------------------------------------------------------------

let resendClient;
function getResendClient() {
  if (!resendClient) {
    const { Resend } = require('resend');
    resendClient = new Resend(RESEND_API_KEY);
    console.log('[mailer] Using Resend HTTP API for email delivery.');
  }
  return resendClient;
}

async function sendViaResend({ to, subject, text, html }) {
  const client = getResendClient();
  const { data, error } = await client.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
  if (error) {
    console.error('[mailer] Resend send failed:', error);
    const err = new Error(error.message || 'Resend send failed');
    err.code = error.name || 'RESEND_ERROR';
    throw err;
  }
  console.log('[mailer] Resend send ok:', data && data.id);
  return data;
}

// ---------------------------------------------------------------------------
// Gmail SMTP (nodemailer) transport — local dev fallback
// ---------------------------------------------------------------------------

let transporter;

function getTransporter() {
  if (!EMAIL_APP_PASSWORD) {
    throw new Error(
      'Email service is not configured. Set RESEND_API_KEY (recommended for production) or EMAIL_APP_PASSWORD (local dev via Gmail SMTP).',
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS upgrade
      requireTLS: true,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_APP_PASSWORD,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    transporter.verify().then(
      () => console.log('[mailer] SMTP transporter verified and ready.'),
      (err) =>
        console.error(
          '[mailer] SMTP verify failed:',
          err && err.message ? err.message : err,
        ),
    );
  }

  return transporter;
}

async function sendViaSmtp({ to, subject, text, html }) {
  const mailer = getTransporter();
  try {
    await mailer.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('[mailer] sendMail failed:', err && err.message ? err.message : err);
    if (err && err.code) console.error('[mailer] error code:', err.code);
    if (err && err.response) console.error('[mailer] server response:', err.response);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function sendMail(opts) {
  if (RESEND_API_KEY) {
    return sendViaResend(opts);
  }
  return sendViaSmtp(opts);
}

async function sendVerificationEmail(email, name, code) {
  return sendMail({
    to: email,
    subject: 'Your WA Bulk Sender verification code',
    text: `Hi ${name},\n\nYour verification code is ${code}. It expires in 30 minutes.\n\nIf you did not create this account, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Verify your WA Bulk Sender account</h2>
        <p>Hi ${name},</p>
        <p>Your verification code is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in 30 minutes.</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(email, name, code) {
  return sendMail({
    to: email,
    subject: 'Your WA Bulk Sender password reset code',
    text: `Hi ${name},\n\nYour password reset code is ${code}. It expires in 30 minutes.\n\nIf you did not request a password reset, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Reset your WA Bulk Sender password</h2>
        <p>Hi ${name},</p>
        <p>Your password reset code is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in 30 minutes.</p>
      </div>
    `,
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
