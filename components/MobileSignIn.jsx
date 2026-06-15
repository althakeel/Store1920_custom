import React, { useState } from 'react';
import OtpInput from '@/components/OtpInput';

export default function MobileSignIn({ onSuccess }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (typeof window === 'undefined') throw new Error('Window is undefined');
      const ensureRecaptcha = () => {
        return new Promise((resolve, reject) => {
          const check = () => {
            const container = document.getElementById('recaptcha-container');
            if (!container) return reject(new Error('Recaptcha container not found'));
            const RecaptchaVerifier = window.firebase && window.firebase.auth && window.firebase.auth.RecaptchaVerifier;
            if (!RecaptchaVerifier) return setTimeout(check, 100);
            if (!window.recaptchaVerifier) {
              window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, window.firebase.auth());
            }
            resolve(window.recaptchaVerifier);
          };
          check();
        });
      };
      const appVerifier = await ensureRecaptcha();
      const confirmationResult = await window.firebase.auth().signInWithPhoneNumber(phone, appVerifier);
      setConfirmation(confirmationResult);
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!confirmation) throw new Error('No confirmation result');
      const result = await confirmation.confirm(otp);
      setOtp('');
      setPhone('');
      setStep('phone');
      if (onSuccess) onSuccess(result.user);
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-6 p-4 bg-white rounded-xl shadow">
      <h2 className="text-lg font-bold mb-4 text-center">Sign in with Mobile</h2>
      {step === 'phone' && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Enter mobile number"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none"
            required
            disabled={loading}
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
            disabled={loading}
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      )}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <OtpInput value={otp} onChange={setOtp} length={6} />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
            disabled={loading || otp.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
      )}
      <div id="recaptcha-container"></div>
      {error && <p className="text-red-600 text-sm mt-2 text-center">{error}</p>}
    </div>
  );
}
