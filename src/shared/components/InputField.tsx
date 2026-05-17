import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface InputFieldProps {
  id: string;
  name: string;
  type?: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  placeholder?: string;
  error?: string;
  icon?: LucideIcon;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  options?: { value: string; label: string }[]; // For select dropdown
}

export const InputField: React.FC<InputFieldProps> = ({
  id,
  name,
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  error,
  icon: Icon,
  required = false,
  disabled = false,
  autoComplete,
  options,
  onBlur,
}) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const isPassword = type === 'password';
  const isSelect = !!options;
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-1.5">
      <label 
        htmlFor={id} 
        className="block text-sm font-semibold text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className={`w-5 h-5 ${error ? 'text-red-400' : 'text-gray-400'}`} />
          </div>
        )}
        
        {isSelect ? (
          <select
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            className={`
              w-full px-4 py-3 rounded-xl border-2 bg-white
              transition-all duration-200 outline-none
              ${Icon ? 'pl-11' : ''}
              ${error 
                ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                : 'border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
              }
              ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'hover:border-gray-300'}
            `}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            name={name}
            type={inputType}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete={autoComplete}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`
              w-full px-4 py-3 rounded-xl border-2 bg-white
              transition-all duration-200 outline-none
              ${Icon ? 'pl-11' : ''}
              ${isPassword ? 'pr-11' : ''}
              ${error 
                ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                : 'border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
              }
              ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'hover:border-gray-300'}
              placeholder:text-gray-400
            `}
          />
        )}

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>

      {error && (
        <motion.p 
          id={`${id}-error`}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-600 font-medium"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};

import { motion } from 'framer-motion';
