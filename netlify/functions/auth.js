const bcrypt = require('../../backend/node_modules/bcryptjs');
const jwt = require('../../backend/node_modules/jsonwebtoken');

const db = require('../../backend/db/database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../backend/utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'wa-bulk-tool-secret-key-change-in-production';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

function getSubPath(event) {
  const path = event.path || '';
  const idx = path.indexOf('/auth/');
  if (idx === -1) return '';
  return path.slice(idx + '/auth/'.length).replace(/^\/+/, '');
}

function getTokenFromHeader(event) {
  const header = event.headers?.authorization || event.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

async function handleRegister(body) {
  const { email, password, name } = body;

  if (!email || !password || !name) {
    return json(400, { error: 'Email, password, and name are required' });
  }
  if (password.length < 6) {
    return json(400, { error: 'Password must be at least 6 characters' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    if (!existing.is_verified) {
      const code = db.resendVerification(email);
      try {
        await sendVerificationEmail(existing.email, existing.name, code);
      } catch (error) {
        return json(500, { error: error.message });
      }

      return json(409, {
        error: 'Email already registered but not verified',
        needsVerification: true,
        email: existing.email,
      });
    }
    return json(409, { error: 'Email already registered' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { verification_code } = db.createUser(email, hash, name);
    await sendVerificationEmail(email, name, verification_code);

    return json(200, {
      message: 'Registration successful. Please verify your email.',
      email,
    });
  } catch (error) {
    return json(500, { error: error.message });
  }
}

async function handleLogin(body) {
  const { email, password } = body;
  if (!email || !password) {
    return json(400, { error: 'Email and password are required' });
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    return json(401, { error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return json(401, { error: 'Invalid email or password' });
  }

  if (!user.is_verified) {
    return json(403, {
      error: 'Email not verified',
      needsVerification: true,
      email: user.email,
    });
  }

  db.updateLastLogin(user.id);

  const token = jwt.sign(
    { id: user.id, email: user.email, is_admin: user.is_admin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return json(200, {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      credits: user.credits,
    },
  });
}

function handleVerify(body) {
  const { email, code } = body;
  if (!email || !code) {
    return json(400, { error: 'Email and verification code required' });
  }

  const result = db.verifyUser(email, code);
  if (!result.success) {
    return json(400, { error: result.error });
  }

  const user = db.getUserByEmail(email);
  const token = jwt.sign(
    { id: user.id, email: user.email, is_admin: user.is_admin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return json(200, {
    message: 'Email verified successfully',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      credits: user.credits,
    },
  });
}

async function handleResendVerification(body) {
  const { email } = body;
  if (!email) return json(400, { error: 'Email required' });

  const user = db.getUserByEmail(email);
  if (!user) return json(404, { error: 'User not found' });
  if (user.is_verified) return json(400, { error: 'Already verified' });

  const code = db.resendVerification(email);
  try {
    await sendVerificationEmail(user.email, user.name, code);
  } catch (error) {
    return json(500, { error: error.message });
  }

  return json(200, { message: 'Verification code resent' });
}

async function handleForgotPassword(body) {
  const { email } = body;
  if (!email) {
    return json(400, { error: 'Email is required' });
  }

  const reset = db.createPasswordReset(email);
  if (!reset) {
    return json(200, {
      message: 'If an account exists for that email, a reset code has been sent.',
    });
  }

  try {
    await sendPasswordResetEmail(reset.user.email, reset.user.name, reset.code);
  } catch (error) {
    return json(500, { error: error.message });
  }

  return json(200, {
    message: 'If an account exists for that email, a reset code has been sent.',
  });
}

async function handleResetPassword(body) {
  const { email, code, password } = body;

  if (!email || !code || !password) {
    return json(400, { error: 'Email, reset code, and new password are required' });
  }
  if (password.length < 6) {
    return json(400, { error: 'Password must be at least 6 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.resetPassword(email, code, hash);
    if (!result.success) {
      return json(400, { error: result.error });
    }
    return json(200, { message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    return json(500, { error: error.message });
  }
}

function handleMe(event) {
  const token = getTokenFromHeader(event);
  if (!token) {
    return json(401, { error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.getUserById(decoded.id);
    if (!user) return json(401, { error: 'User not found' });
    if (!user.is_verified) return json(403, { error: 'Email not verified' });

    return json(200, {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      credits: user.credits,
      created_at: user.created_at,
    });
  } catch {
    return json(401, { error: 'Invalid or expired token' });
  }
}

exports.handler = async (event) => {
  const subPath = getSubPath(event);
  const method = event.httpMethod || 'GET';
  const body = parseBody(event);

  if (body === null) {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (method === 'POST' && subPath === 'register') return handleRegister(body);
  if (method === 'POST' && subPath === 'login') return handleLogin(body);
  if (method === 'POST' && subPath === 'verify') return handleVerify(body);
  if (method === 'POST' && subPath === 'resend-verification') return handleResendVerification(body);
  if (method === 'POST' && subPath === 'forgot-password') return handleForgotPassword(body);
  if (method === 'POST' && subPath === 'reset-password') return handleResetPassword(body);
  if (method === 'GET' && subPath === 'me') return handleMe(event);

  return json(404, { error: 'Not found' });
};
