import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const passedEmail = location.state?.email || '';
  const passedCode = location.state?.code || '';

  const [email, setEmail] = useState(passedEmail);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.token, data.user);
      toast.success('Email verified! Welcome!');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('New code sent!');
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
            Enter the 6-digit code sent to your email
          </p>
        </div>

        {passedCode && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 text-center">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Development mode:</strong> Your verification code is{' '}
              <span className="font-mono font-bold text-lg">{passedCode}</span>
            </p>
          </div>
        )}

        <form onSubmit={handleVerify} className="card space-y-4">
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
    </div>
  );
}
