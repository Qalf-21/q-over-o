import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, GraduationCap, ArrowRightLeft } from 'lucide-react';
import { useInView } from 'framer-motion';

export const DualRole: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeTab, setActiveTab] = useState<'learn' | 'teach'>('learn');

  return (
    <section id="tutors" ref={ref} className="py-20 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            One Account. Two Ways.
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Learn today. Teach tomorrow. Switch anytime.
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
              Get Help (Tutee)
            </button>
            <button
              onClick={() => setActiveTab('teach')}
              className={`px-6 py-3 rounded-full font-medium transition-all ${
                activeTab === 'teach'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Give Help (Tutor)
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
              className="bg-white rounded-3xl shadow-xl overflow-hidden"
            >
              {activeTab === 'learn' ? (
                <div className="grid md:grid-cols-2">
                  <div className="p-8 sm:p-12">
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                      <BookOpen className="w-7 h-7 text-indigo-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      Struggling With Class?
                    </h3>
                    <ul className="space-y-3 mb-8">
                      {[
                        "Find tutors in your course",
                        "Book instant sessions",
                        "Pay with M-Pesa",
                        "Learn at your pace"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-gray-600">
                          <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-indigo-600 p-8 sm:p-12 flex items-center justify-center">
                    <div className="text-white text-center">
                      <div className="text-5xl font-bold mb-2">500+</div>
                      <div className="text-indigo-200">Tutors Available</div>
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
                      Good at Something?
                    </h3>
                    <ul className="space-y-3 mb-8">
                      {[
                        "Set your own price",
                        "Teach when free",
                        "Earn real money",
                        "Build your resume"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-gray-600">
                          <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-purple-600 p-8 sm:p-12 flex items-center justify-center">
                    <div className="text-white text-center">
                      <div className="text-5xl font-bold mb-2">KES 5k+</div>
                      <div className="text-purple-200">Average Monthly Earnings</div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center mt-8">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <ArrowRightLeft className="w-4 h-4" />
              <span>Switch roles anytime in settings</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};