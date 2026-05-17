import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { InputField } from '../../../shared/components/InputField';
import { AuthButton } from '../../../shared/components/AuthButton';
import { authApi } from '../../../api/authApi';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { email as emailRule, required, useFormValidation } from '../../../shared/hooks/useFormValidation';
import { parseApiError } from '../../../shared/utils/apiError';
import { useToast } from '../../../shared/components/Toast';

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail]           = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const { showToast } = useToast();
  const formData = { email };
  const { errors, validateField, validateForm, clearFieldError, setFieldErrors } = useFormValidation(formData, {
    email: [required('Email'), emailRule],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEmail(e.target.value);
    clearFieldError('email');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      // redirectTo tells Supabase where to send the user after they click
      // the link in their email. Adjust to match your deployed domain.
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/login`
          : undefined;
      await authApi.resetPassword(email.trim().toLowerCase(), redirectTo);
      setSubmitted(true);
      showToast({ type: 'success', title: 'Reset link sent', message: 'Check your inbox for the reset email.' });
    } catch (err) {
      const parsed = parseApiError(err, 'Could not send the reset link.');
      setFieldErrors(Object.keys(parsed.fieldErrors).length ? parsed.fieldErrors : { email: parsed.message });
      if (parsed.retryable) {
        showToast({
          type: 'error',
          title: 'Reset email failed',
          message: parsed.message,
          duration: 0,
          action: { label: 'Retry', onClick: () => void authApi.resetPassword(email.trim().toLowerCase()) },
        });
      }
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
        <InputField
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={email}
          onChange={handleChange}
          placeholder="you@university.ac.ke"
          icon={Mail}
          error={errors.email}
          onBlur={() => validateField('email')}
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
