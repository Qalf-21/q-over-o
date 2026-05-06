import React from 'react';
import { motion } from 'framer-motion';
import { Video, UserCheck, Wallet, Star, Clock, Shield } from 'lucide-react';
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
      icon: Video,
      title: "Live Video + Whiteboard",
      desc: "See and talk in real time. Draw diagrams together."
    },
    {
      icon: UserCheck,
      title: "Smart Matching",
      desc: "We find the best tutor for your course and level."
    },
    {
      icon: Wallet,
      title: "M-Pesa Payments",
      desc: "Buy tokens with M-Pesa. Safe and instant."
    },
    {
      icon: Star,
      title: "Ratings & Reviews",
      desc: "Rate your tutor. Good tutors get more students."
    },
    {
      icon: Clock,
      title: "Flexible Time",
      desc: "Book now or later. 24/7 availability."
    },
    {
      icon: Shield,
      title: "Safe & Secure",
      desc: "Verified students only. Your data is protected."
    }
  ];

  return (
    <section id="features" ref={ref} className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need
          </h2>
          <p className="text-lg text-gray-600">
            Built for campus life. Built for you.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              whileHover={{ y: -5 }}
              className="p-6 rounded-2xl bg-white border border-gray-100 shadow-lg hover:shadow-xl transition-all"
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