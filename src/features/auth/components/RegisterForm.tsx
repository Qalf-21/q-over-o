/**
 * Register Form Component
 * Handles new user registration
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { AuthLayout } from './AuthLayout';
import { InputField } from '../../../shared/components/InputField';
import { AuthButton } from '../../../shared/components/AuthButton';
import { User, Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { email as emailRule, minLength, required, useFormValidation } from '../../../shared/hooks/useFormValidation';
import { parseApiError } from '../../../shared/utils/apiError';
import { useToast } from '../../../shared/components/Toast';

export const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { register, clearError, isLoading } = useAuth();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const { errors, validateField, validateForm, clearFieldError, setFieldErrors } = useFormValidation(formData, {
    first_name: [required('First name'), minLength('First name', 2)],
    last_name: [required('Last name'), minLength('Last name', 2)],
    email: [required('Email'), emailRule],
    password: [required('Password'), minLength('Password', 8)],
    confirmPassword: [(_, values) => values.password === values.confirmPassword ? '' : 'Passwords do not match'],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearFieldError(name as keyof typeof formData);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    try {
      await register(formData.first_name, formData.last_name, formData.email, formData.password);
      showToast({ type: 'success', title: 'Account created', message: 'Welcome to Q-over-o.' });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const parsed = parseApiError(err, 'Could not create your account. Please try again.');
      setFieldErrors(parsed.fieldErrors);
      if (!Object.keys(parsed.fieldErrors).length) {
        setFieldErrors({ email: parsed.message });
      }
      if (parsed.retryable) {
        showToast({
          type: 'error',
          title: 'Registration failed',
          message: parsed.message,
          duration: 0,
          action: { label: 'Retry', onClick: () => void register(formData.first_name, formData.last_name, formData.email, formData.password) },
        });
      }
    }
  };

  return (
    <AuthLayout 
      title="Create your account"
      subtitle="Use one account to learn, book sessions, and build a tutor profile when ready."
      showBackButton={true}
      backTo="/"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <InputField
          id="first_name"
          name="first_name"
          type="text"
          label="First Name"
          value={formData.first_name}
          onChange={handleChange}
          placeholder="First name"
          icon={User}
          error={errors.first_name}
          onBlur={() => validateField('first_name')}
          required
          autoComplete="given-name"
          disabled={isLoading}
        />

        <InputField
          id="last_name"
          name="last_name"
          type="text"
          label="Last Name"
          value={formData.last_name}
          onChange={handleChange}
          placeholder="Last name"
          icon={User}
          error={errors.last_name}
          onBlur={() => validateField('last_name')}
          required
          autoComplete="family-name"
          disabled={isLoading}
        />

        <InputField
          id="email"
          name="email"
          type="email"
          label="Email"
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

        <InputField
          id="password"
          name="password"
          type="password"
          label="Password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Min. 8 characters"
          icon={Lock}
          error={errors.password}
          onBlur={() => validateField('password')}
          required
          autoComplete="new-password"
          disabled={isLoading}
        />

        <InputField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Re-enter password"
          icon={Lock}
          error={errors.confirmPassword}
          onBlur={() => validateField('confirmPassword')}
          required
          autoComplete="new-password"
          disabled={isLoading}
        />

        <div className="flex items-start gap-3 py-2">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            Create an account to access role-aware dashboards, session workflows, wallet activity, and tutor onboarding tools.
          </p>
        </div>

        <AuthButton 
          type="submit" 
          isLoading={isLoading}
          disabled={isLoading}
          icon={<ArrowRight className="w-5 h-5" />}
        >
          Create account
        </AuthButton>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <p className="text-gray-600">
          Already have an account?{' '}
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
