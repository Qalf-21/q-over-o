import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { InputField } from '../../../shared/components/InputField';
import { AuthButton } from '../../../shared/components/AuthButton';
import { authApi } from '../../../api/authApi';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail]           = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fieldError, setFieldError] = useState('');

  const validate = (): boolean => {
    if (!email.trim()) {
      setFieldError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFieldError('Please enter a valid email address');
      return false;
    }
    setFieldError('');
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEmail(e.target.value);
    if (fieldError) setFieldError('');
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsLoading(true);
      setError(null);
      // redirectTo tells Supabase where to send the user after they click
      // the link in their email. Adjust to match your deployed domain.
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/login`
          : undefined;
      await authApi.resetPassword(email.trim().toLowerCase(), redirectTo);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle={`We sent a reset link to ${email}`}
        showBackButton
        backTo="/login"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
              Click the link in the email to reset your password. The link expires in 1 hour.
              If you don't see it, check your spam folder.
            </p>
          </div>

          <Link
            to="/login"
            className="block w-full py-3.5 px-6 rounded-xl font-semibold text-base text-center
                       bg-gradient-to-r from-indigo-600 to-purple-600 text-white
                       hover:opacity-90 transition-opacity"
          >
            Back to sign in
          </Link>

          <p className="text-center text-sm text-gray-500">
            Wrong email?{' '}
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Try again
            </button>
          </p>
        </div>
      </AuthLayout>
    );
  }

  // ── Request form ───────────────────────────────────────────────────────────
  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link"
      showBackButton
      backTo="/login"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        <InputField
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={email}
          onChange={handleChange}
          placeholder="you@university.ac.ke"
          icon={Mail}
          error={fieldError}
          required
          autoComplete="email"
          disabled={isLoading}
        />

        <AuthButton
          type="submit"
          isLoading={isLoading}
          disabled={isLoading}
          icon={<ArrowRight className="w-5 h-5" />}
        >
          Send reset link
        </AuthButton>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <p className="text-gray-600">
          Remember your password?{' '}
          <Link
            to="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
