/**
 * Login Form Component
 * Handles user authentication
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { AuthLayout } from './AuthLayout';
import { InputField } from '../../../shared/components/InputField';
import { AuthButton } from '../../../shared/components/AuthButton';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { email as emailRule, required, useFormValidation } from '../../../shared/hooks/useFormValidation';
import { parseApiError } from '../../../shared/utils/apiError';
import { useToast } from '../../../shared/components/Toast';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login, clearError, isLoading } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const { errors, validateField, validateForm, clearFieldError, setFieldErrors } = useFormValidation(formData, {
    email: [required('Email'), emailRule],
    password: [required('Password')],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name as keyof typeof formData);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const parsed = parseApiError(err, 'Could not sign in. Check your details and try again.');
      setFieldErrors(parsed.fieldErrors);
      if (!Object.keys(parsed.fieldErrors).length) {
        setFieldErrors({ password: parsed.message });
      }
      if (parsed.retryable) {
        showToast({
          type: 'error',
          title: 'Sign in failed',
          message: parsed.message,
          duration: 0,
          action: { label: 'Retry', onClick: () => void login(formData.email, formData.password) },
        });
      }
    }
  };

  return (
      <AuthLayout
      title="Welcome back"
      subtitle="Access your sessions, wallet, reviews, and role-based dashboard."
      showBackButton
      backTo="/"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <InputField
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@example.com"
          icon={Mail}
          error={errors.email}
          onBlur={() => validateField('email')}
          required
          autoComplete="email"
          disabled={isLoading}
        />

        <div className="space-y-1">
          <InputField
            id="password"
            name="password"
            type="password"
            label="Password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            icon={Lock}
            error={errors.password}
            onBlur={() => validateField('password')}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />
          {/* Forgot password link — was missing from original */}
          <div className="text-right">
            <Link
              to="/forgot-password"
            className="text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <AuthButton
          type="submit"
          isLoading={isLoading}
          disabled={isLoading}
          icon={<ArrowRight className="w-5 h-5" />}
        >
          Sign in
        </AuthButton>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <p className="text-gray-600">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
