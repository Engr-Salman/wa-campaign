const nodemailer = require('nodemailer');

const EMAIL_FROM = process.env.EMAIL_FROM || 'salman.ahm97@gmail.com';
const EMAIL_USER = process.env.EMAIL_USER || EMAIL_FROM;
// Gmail App Passwords are displayed with spaces (`xxxx xxxx xxxx xxxx`) but
// must be sent to SMTP without them.  Strip all whitespace just in case.
const EMAIL_APP_PASSWORD = (process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

let transporter;

function getTransporter() {
  if (!EMAIL_APP_PASSWORD) {
    throw new Error('Email service is not configured. Set EMAIL_APP_PASSWORD in .env');
  }

  if (!transporter) {
    // Use explicit SMTP host/port instead of `service: 'gmail'`.
    //
    // - Port 587 with STARTTLS is far more reliable on cloud hosts like
    //   Railway / Render than the default 465 SMTPS (some providers block
    //   or throttle 465 outbound).
    // - Explicit timeouts prevent the request from hanging for minutes if
    //   the SMTP connection can't be established — we fail fast and surface
    //   a real error instead of "Connection timeout" from the HTTP proxy.
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,       // STARTTLS upgrade
      requireTLS: true,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_APP_PASSWORD,
      },
      connectionTimeout: 15000, // 15s to open TCP connection
      greetingTimeout:   15000, // 15s to receive SMTP greeting
      socketTimeout:     20000, // 20s for each read/write
    });

    // Verify once at startup so credential / network problems show up in
    // the Railway logs immediately instead of on the first register call.
    transporter.verify().then(
      () => console.log('[mailer] SMTP transporter verified and ready.'),
      (err) => console.error('[mailer] SMTP verify failed:', err && err.message ? err.message : err),
    );
  }

  return transporter;
}

async function sendMail({ to, subject, text, html }) {
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
    // Surface the real SMTP error in the Railway logs so we can diagnose
    // connection / auth problems without guessing.
    console.error('[mailer] sendMail failed:', err && err.message ? err.message : err);
    if (err && err.code) console.error('[mailer] error code:', err.code);
    if (err && err.response) console.error('[mailer] server response:', err.response);
    throw err;
  }
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
