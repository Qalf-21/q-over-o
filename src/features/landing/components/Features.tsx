import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Search, ShieldCheck, Star, TrendingUp, Wallet } from 'lucide-react';
import { useInView } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export const Features: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const features: Feature[] = [
    {
      icon: Search,
      title: "Tutor discovery",
      desc: "Learners can browse tutor profiles, subjects, availability, and quality signals before booking."
    },
    {
      icon: CalendarDays,
      title: "Session management",
      desc: "Bookings, upcoming sessions, completion states, and learning history are managed from role-aware dashboards."
    },
    {
      icon: Wallet,
      title: "Wallet payments",
      desc: "The token wallet supports purchases, spending visibility, session deductions, and escrow-aware payment movement."
    },
    {
      icon: Star,
      title: "Reviews and ratings",
      desc: "Learners can review completed sessions, helping future students evaluate tutor quality more transparently."
    },
    {
      icon: TrendingUp,
      title: "Tutor progression",
      desc: "Tutors can track teaching hours, ratings, reviewer diversity, and qualification progress from their dashboard."
    },
    {
      icon: ShieldCheck,
      title: "Operational oversight",
      desc: "Admin workflows support user, wallet, session, review, subject, and exception monitoring."
    }
  ];

  return (
    <section id="features" ref={ref} className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="mb-4 text-3xl font-bold text-gray-950 sm:text-4xl">
            Platform capabilities
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-gray-600">
            Q-over-o focuses on practical tutoring workflows: finding help, booking time, managing payments, and maintaining accountable learning records.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-colors hover:border-indigo-100"
            >
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
