import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { KeyRound, Mail, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { readJsonResponse } from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to send reset code');

      setRequested(true);
      toast.success('If the account exists, a reset code has been sent.');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setResetting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      toast.success('Password reset successful. You can now sign in.');
      setCode('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <KeyRound className="mx-auto text-whatsapp mb-3" size={48} />
          <h1 className="text-3xl font-bold">Reset Password</h1>
          <p className="text-gray-500 mt-1">We’ll send a reset code to your email</p>
        </div>

        <div className="card space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Mail size={18} />
              {sending ? 'Sending code...' : requested ? 'Resend Code' : 'Send Reset Code'}
            </button>
          </form>

          <form onSubmit={resetPassword} className="space-y-4 border-t pt-5">
            <div>
              <label className="block text-sm font-medium mb-1">Reset Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input-field text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Min 6 characters"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Repeat new password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={resetting}
              className="btn-primary w-full"
            >
              {resetting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Back to{' '}
            <Link to="/login" className="text-whatsapp hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}
