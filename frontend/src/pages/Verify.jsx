import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ShieldCheck, Mail, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiUrl, readJsonResponse } from '../utils/api';

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const passedEmail = location.state?.email || '';

  const [email, setEmail] = useState(passedEmail);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      login(data.token, data.user);
      toast.success('Email verified! Welcome!');
      navigate('/');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error);
      toast.success('A new verification code has been sent to your email.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Mail className="mx-auto text-whatsapp mb-3" size={48} />
          <h1 className="text-3xl font-bold">Verify Your Email</h1>
          <p className="text-gray-500 mt-1">
            Enter the 6-digit verification code
          </p>
        </div>

        <form onSubmit={handleVerify} className="card space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Verification Code
            </label>
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
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} />
            {submitting ? 'Verifying...' : 'Verify Email'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            className="w-full text-sm text-whatsapp hover:underline"
          >
            Didn't receive a code? Resend
          </button>
        </form>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}
