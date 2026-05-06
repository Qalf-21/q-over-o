/**
 * Login Form Component
 * Handles user authentication
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { authApi } from '../../../api/authApi';
import { AuthLayout } from './AuthLayout';
import { InputField } from '../../../shared/components/InputField';
import { AuthButton } from '../../../shared/components/AuthButton';
import { Mail, Lock, ArrowRight } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login, error, clearError, isLoading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
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
      await login(formData.email, formData.password);
      const user = authApi.getStoredUser();
      navigate(user?.role === 'tutor' ? '/dashboard' : '/dashboard/discover', { replace: true });
    } catch (err) {
      // Error handled by context
    }
  };

  return (
    <AuthLayout 
      title="Welcome back"
      subtitle="Sign in to your Q-over-o account"
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
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@university.ac.ke"
          icon={Mail}
          error={validationErrors.email}
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
            error={validationErrors.password}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />
        </div>

        <AuthButton 
          type="submit" 
          isLoading={isLoading}
          disabled={isLoading}
          icon={<ArrowRight className="w-5 h-5" />}
        >
          Sign In
        </AuthButton>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <p className="text-gray-600">
          Don't have an account?{' '}
          <Link 
            to="/register" 
            className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Create one free
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
