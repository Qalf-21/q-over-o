import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, BookOpen, CheckCircle2, GraduationCap } from 'lucide-react';
import { useInView } from 'framer-motion';

export const DualRole: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeTab, setActiveTab] = useState<'learn' | 'teach'>('learn');

  return (
    <section id="tutors" ref={ref} className="bg-gradient-to-br from-indigo-50 to-purple-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Built for students and tutors
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Q-over-o supports learning and tutoring workflows without requiring separate accounts or duplicated profile management.
          </p>
        </motion.div>

        {/* Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-white p-1 rounded-full shadow-md inline-flex">
            <button
              onClick={() => setActiveTab('learn')}
              className={`px-6 py-3 rounded-full font-medium transition-all ${
                activeTab === 'learn'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Student path
            </button>
            <button
              onClick={() => setActiveTab('teach')}
              className={`px-6 py-3 rounded-full font-medium transition-all ${
                activeTab === 'teach'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tutor path
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              {activeTab === 'learn' ? (
                <div className="grid md:grid-cols-2">
                  <div className="p-8 sm:p-12">
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                      <BookOpen className="w-7 h-7 text-indigo-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      Learn with more structure
                    </h3>
                    <ul className="space-y-3 mb-8">
                      {[
                        "Discover tutors by subject",
                        "Book sessions through the platform",
                        "Track session history and reviews",
                        "Understand token spending from wallet records"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-gray-600">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-indigo-600 p-8 sm:p-12">
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white">
                      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-100">Student workspace</p>
                      <div className="mt-6 space-y-3">
                        {['Tutor search', 'Upcoming sessions', 'Learning history', 'Wallet activity'].map((item) => (
                          <div key={item} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-medium">{item}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2">
                  <div className="p-8 sm:p-12">
                    <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
                      <GraduationCap className="w-7 h-7 text-purple-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      Grow a tutoring record
                    </h3>
                    <ul className="space-y-3 mb-8">
                      {[
                        "Manage availability and sessions",
                        "Track earnings and payout status",
                        "Build ratings through completed sessions",
                        "Follow qualification progress honestly"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-gray-600">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-purple-600 p-8 sm:p-12">
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white">
                      <p className="text-sm font-semibold uppercase tracking-wider text-purple-100">Tutor workspace</p>
                      <div className="mt-6 space-y-3">
                        {['Teaching sessions', 'Availability', 'Earnings', 'Qualification status'].map((item) => (
                          <div key={item} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-medium">{item}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center mt-8">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <ArrowRightLeft className="w-4 h-4" />
              <span>Tutors can also use learner tools when they need academic support.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
