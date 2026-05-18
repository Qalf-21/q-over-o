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
  const baseStyles = 'w-full px-6 py-3.5 text-base active:scale-[0.98]';

  const variants = {
    primary: 'app-button-primary',
    secondary: 'app-button-secondary',
    outline: 'app-button-secondary border-indigo-200 text-indigo-700'
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
