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

export const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { register, error, clearError, isLoading } = useAuth();
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required';
    } else if (formData.first_name.trim().length < 2) {
      errors.first_name = 'First name must be at least 2 characters';
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required';
    } else if (formData.last_name.trim().length < 2) {
      errors.last_name = 'Last name must be at least 2 characters';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid university email';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    try {
      await register(formData.first_name, formData.last_name, formData.email, formData.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Error handled by context
    }
  };

  return (
    <AuthLayout 
      title="Create your account"
      subtitle="Join Q-over-o and start learning"
      showBackButton={true}
      backTo="/"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        <InputField
          id="first_name"
          name="first_name"
          type="text"
          label="First Name"
          value={formData.first_name}
          onChange={handleChange}
          placeholder="John"
          icon={User}
          error={validationErrors.first_name}
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
          placeholder="Doe"
          icon={User}
          error={validationErrors.last_name}
          required
          autoComplete="family-name"
          disabled={isLoading}
        />

        <InputField
          id="email"
          name="email"
          type="email"
          label="University Email"
          value={formData.email}
          onChange={handleChange}
          placeholder="john@university.ac.ke"
          icon={Mail}
          error={validationErrors.email}
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
          error={validationErrors.password}
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
          error={validationErrors.confirmPassword}
          required
          autoComplete="new-password"
          disabled={isLoading}
        />

        <div className="flex items-start gap-3 py-2">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            By signing up, you agree to our Terms of Service and Privacy Policy. 
            Your data is secure and never shared.
          </p>
        </div>

        <AuthButton 
          type="submit" 
          isLoading={isLoading}
          disabled={isLoading}
          icon={<ArrowRight className="w-5 h-5" />}
        >
          Create Account
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
