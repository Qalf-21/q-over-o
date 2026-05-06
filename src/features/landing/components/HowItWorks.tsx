import React from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Video, CreditCard } from 'lucide-react';
import { useInView } from 'framer-motion';

export const HowItWorks: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const steps = [
    {
      icon: Search,
      step: "1",
      title: "Pick Your Subject",
      desc: "Search Calculus, Chemistry, or any course. See who's online."
    },
    {
      icon: Calendar,
      step: "2",
      title: "Book a Session",
      desc: "Choose a time that works. 30 mins or 1 hour."
    },
    {
      icon: Video,
      step: "3",
      title: "Learn Live",
      desc: "Video call with whiteboard. Ask anything. Get answers."
    },
    {
      icon: CreditCard,
      step: "4",
      title: "Pay or Earn",
      desc: "Pay with tokens (M-Pesa). Or earn if you're the tutor."
    }
  ];

  return (
    <section id="how-it-works" ref={ref} className="py-20 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-gray-400 text-lg">Four simple steps. That's it.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              <div className="bg-gray-800 rounded-2xl p-6 h-full border border-gray-700 hover:border-indigo-500 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-4xl font-bold text-gray-700 mb-2">{item.step}</div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
              {index < 3 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                  <div className="w-8 h-0.5 bg-gray-700" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};