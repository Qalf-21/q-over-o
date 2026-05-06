import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInView } from 'framer-motion';

export const CTASection: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-900/50 rounded-full text-indigo-300 text-sm font-medium mb-6 border border-indigo-800">
            <Sparkles className="w-4 h-4" />
            <span>Join 800+ students today</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Study Smarter?
          </h2>
          
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            Don't wait for exams to panic. Get help now. Or start earning by teaching what you know.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-full font-bold text-lg hover:shadow-xl hover:scale-105 transition-all group"
            >
              Sign Up Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 bg-transparent text-white border-2 border-gray-700 px-8 py-4 rounded-full font-bold text-lg hover:border-white transition-all"
            >
              Log In
            </Link>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            No credit card needed. Free to join.
          </p>
        </motion.div>
      </div>
    </section>
  );
};