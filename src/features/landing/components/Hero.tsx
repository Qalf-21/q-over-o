import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, CalendarCheck, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroImage from '../../../assets/hero.png';

export const Hero: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-white pt-28">
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-50 via-white to-white" />
      <div className="absolute right-0 top-28 hidden opacity-70 lg:block">
        <img src={heroImage} alt="" className="h-72 w-72" loading="eager" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm">
              <BookOpen className="h-4 w-4" />
              Structured tutoring for learners and tutors
            </div>

            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-gray-950 sm:text-5xl lg:text-6xl">
              A tutoring platform for clear learning, accountable sessions, and secure payments.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              Q-over-o connects students with tutors, supports scheduled tutoring sessions, handles wallet-based payments, and helps tutors build a visible qualification record over time.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-800 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: CalendarCheck, title: 'Session workflow', text: 'Students book tutoring sessions and manage learning history from the dashboard.' },
            { icon: WalletCards, title: 'Wallet and escrow', text: 'Token purchases, spending, and session payment movement are handled through the wallet system.' },
            { icon: ShieldCheck, title: 'Quality signals', text: 'Reviews, ratings, and qualification progress help learners evaluate tutor fit.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-gray-950">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
