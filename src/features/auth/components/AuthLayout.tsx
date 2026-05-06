import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Logo } from '../../../shared/components/Logo';
import { ArrowLeft, Sparkles, BookOpen, Users, Wallet } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backTo?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  showBackButton = false,
  backTo = '/'
}) => {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left Side - Branding (Hidden on mobile, visible on lg) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-5/12 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
        
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/20" />

        {/* Floating Elements */}
        <motion.div 
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          className="absolute top-20 right-20 w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20"
        />
        <motion.div 
          animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-40 left-10 w-16 h-16 bg-white/10 backdrop-blur-md rounded-full border border-white/20"
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <Logo light size="lg" />
          </div>

          <div className="space-y-8">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl xl:text-5xl font-bold leading-tight"
            >
              Learn Smarter.
              <br />
              <span className="text-indigo-200">Earn While You Study.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-indigo-100 max-w-sm leading-relaxed"
            >
              Join thousands of Kenyan students helping each other succeed. Pay with M-Pesa, learn from anywhere.
            </motion.p>

            {/* Feature Pills */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-3"
            >
              {[
                { icon: BookOpen, text: "Live Video" },
                { icon: Users, text: "Peer Tutoring" },
                { icon: Wallet, text: "M-Pesa Ready" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-3 text-sm text-indigo-200"
          >
            <Sparkles className="w-4 h-4" />
            <span>Trusted by 800+ students across Kenya</span>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col bg-gray-50/50">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b px-4 py-4">
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            {showBackButton && (
              <Link 
                to={backTo} 
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            )}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Desktop Back Button */}
            {showBackButton && (
              <Link 
                to={backTo}
                className="hidden lg:inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to {backTo === '/' ? 'home' : 'login'}
              </Link>
            )}

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-gray-600">{subtitle}</p>
                )}
              </div>

              {children}
            </div>

            {/* Trust Badges */}
            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Secure SSL
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                M-Pesa Protected
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};