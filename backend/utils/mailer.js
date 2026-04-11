const nodemailer = require('nodemailer');

const EMAIL_FROM = process.env.EMAIL_FROM || 'salman.ahm97@gmail.com';
const EMAIL_USER = process.env.EMAIL_USER || EMAIL_FROM;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

let transporter;

function getTransporter() {
  if (!EMAIL_APP_PASSWORD) {
    throw new Error('Email service is not configured. Set EMAIL_APP_PASSWORD in .env');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_APP_PASSWORD,
      },
    });
  }

  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const mailer = getTransporter();
  await mailer.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
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
