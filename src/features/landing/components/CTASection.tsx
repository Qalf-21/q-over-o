import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ClipboardCheck, ShieldCheck, Star, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInView } from 'framer-motion';

export const CTASection: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="trust" ref={ref} className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-950 sm:text-4xl">Trust and transparency</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">
            The platform is designed around traceable tutoring activity, clear payment movement, and role-based oversight.
          </p>
        </div>

        <div className="mb-12 grid gap-4 md:grid-cols-4">
          {[
            { icon: WalletCards, title: 'Wallet records', text: 'Students and tutors can review token transactions and session-linked payment activity.' },
            { icon: ClipboardCheck, title: 'Qualification progress', text: 'Tutor progression uses completed hours, ratings, and reviewer diversity.' },
            { icon: Star, title: 'Review signals', text: 'Reviews are tied to completed tutoring sessions rather than generic marketing claims.' },
            { icon: ShieldCheck, title: 'Admin oversight', text: 'Administrative tools support session, wallet, user, review, and exception monitoring.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-gray-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{item.text}</p>
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="rounded-3xl bg-gray-950 px-6 py-12 text-center sm:px-10 lg:px-16"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-800 bg-indigo-900/40 px-4 py-2 text-sm font-semibold text-indigo-200">
            <ShieldCheck className="h-4 w-4" />
            <span>Transparent tutoring workflows</span>
          </div>
          
          <h2 className="mx-auto max-w-3xl text-3xl font-bold text-white sm:text-4xl">
            Start with a clear account, then choose how you want to use the platform.
          </h2>
          
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-400">
            Create an account to discover tutors, book sessions, manage wallet activity, or begin building your own tutoring profile.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-base font-semibold text-gray-950 shadow-sm transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Get Started
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg border border-gray-700 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:border-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
