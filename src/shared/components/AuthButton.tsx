import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface AuthButtonProps {
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'outline';
  isLoading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  children,
  type = 'button',
  variant = 'primary',
  isLoading = false,
  disabled = false,
  onClick,
  className = '',
  icon
}) => {
  const baseStyles = `
    w-full py-3.5 px-6 rounded-xl font-semibold text-base
    transition-all duration-200
    flex items-center justify-center gap-2
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.98]
  `;

  const variants = {
    primary: `
      bg-gradient-to-r from-indigo-600 to-purple-600 
      text-white shadow-lg shadow-indigo-500/25
      hover:shadow-xl hover:shadow-indigo-500/30
      hover:scale-[1.02]
    `,
    secondary: `
      bg-white text-gray-700 border-2 border-gray-200
      hover:border-indigo-600 hover:text-indigo-600
      shadow-sm
    `,
    outline: `
      bg-transparent text-indigo-600 border-2 border-indigo-600
      hover:bg-indigo-50
    `
  };

  return (
    <motion.button
      whileHover={!disabled && !isLoading ? { scale: 1.01 } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.99 } : {}}
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Please wait...</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </motion.button>
  );
};