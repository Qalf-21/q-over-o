import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Logo } from '../../../shared/components/Logo';
import { ArrowLeft, BookOpenCheck, CalendarCheck, ShieldCheck, WalletCards } from 'lucide-react';

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
    <div className="flex min-h-screen flex-col bg-gray-50 lg:flex-row">
      <aside className="hidden lg:flex lg:w-1/2 xl:w-5/12 bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-900">
        <div className="flex min-h-screen flex-col justify-between p-12 text-white">
          <div>
            <Logo light size="lg" />
          </div>

          <div className="space-y-8">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-md text-4xl font-bold leading-tight xl:text-5xl"
            >
              Account access for structured tutoring workflows.
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-md text-lg leading-8 text-indigo-100"
            >
              Sign in to manage tutoring sessions, learning history, wallet activity, reviews, and tutor qualification progress.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid gap-3"
            >
              {[
                { icon: CalendarCheck, title: 'Session dashboards', text: 'Book, accept, complete, and review tutoring activity.' },
                { icon: WalletCards, title: 'Wallet visibility', text: 'Track token purchases, spending, and payment movement.' },
                { icon: BookOpenCheck, title: 'Learning records', text: 'Keep history, reviews, and tutor progress organized.' },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 p-4">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-100" />
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-5 text-indigo-100">{item.text}</p>
                  </div>
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
            <ShieldCheck className="h-4 w-4" />
            <span>Use your existing account to reach the right dashboard for your role.</span>
          </motion.div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="border-b bg-white px-4 py-4 lg:hidden">
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            {showBackButton && (
              <Link 
                to={backTo} 
                className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-gray-600 transition-colors hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {showBackButton && (
              <Link 
                to={backTo}
                className="mb-6 hidden items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-gray-500 transition-colors hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:inline-flex"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to {backTo === '/' ? 'home' : 'login'}
              </Link>
            )}

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-8">
                <h2 className="mb-2 text-2xl font-bold text-gray-950 sm:text-3xl">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-gray-600">{subtitle}</p>
                )}
              </div>

              {children}
            </div>
            <p className="mt-6 text-center text-xs leading-5 text-gray-500">
              Q-over-o uses authenticated access to protect dashboard, wallet, session, and profile actions.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
