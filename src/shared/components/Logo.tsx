import React from 'react';
import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLogoNavigation } from '../hooks/useLogoNavigation';

interface LogoProps {
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  light?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  showText = true, 
  size = 'md',
  light = false 
}) => {
  const destination = useLogoNavigation();
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-xl' },
    md: { icon: 'w-10 h-10', text: 'text-2xl' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl' }
  };

  return (
    <Link to={destination} className="flex items-center gap-3 group" aria-label="Q-over-o home">
      <div className={`${sizes[size].icon} bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        <GraduationCap className="w-2/3 h-2/3 text-white" />
      </div>
      {showText && (
        <span className={`${sizes[size].text} font-bold ${
          light 
            ? 'text-white' 
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'
        }`}>
          Q-over-o
        </span>
      )}
    </Link>
  );
};
