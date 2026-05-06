import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-indigo-100/50 to-purple-100/50 rounded-bl-[100px]" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-50 to-indigo-50 rounded-tr-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full text-indigo-700 text-sm font-medium mb-6"
            >
              <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
              Now available for all Kenyan universities
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Get Help. <br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Get Paid.
              </span>{' '}
              <br />
              Study Smart.
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-lg leading-relaxed">
              Connect with campus tutors for live video lessons. 
              Pay with M-Pesa. Learn from your phone anytime.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:shadow-xl hover:scale-105 transition-all group"
              >
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 border-2 border-gray-200 px-8 py-4 rounded-full font-semibold text-lg hover:border-indigo-600 hover:text-indigo-600 transition-all"
              >
                <Play className="w-5 h-5" />
                Become a Tutor
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-4 text-sm text-gray-500">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <p>Joined by 500+ students this week</p>
            </div>
          </motion.div>

          {/* Hero Image/Graphic */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-1 shadow-2xl">
              <div className="bg-white rounded-[22px] p-6 sm:p-8">
                <div className="space-y-4">
                  {/* Mock Tutor Card */}
                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-2 bg-gray-200 rounded w-1/2" />
                    </div>
                    <span className="text-green-600 font-semibold">KES 250/hr</span>
                  </div>

                  {/* Mock Video Call UI */}
                  <div className="bg-gray-900 rounded-2xl aspect-video flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50" />
                    <div className="relative text-center text-white">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <Play className="w-8 h-8 ml-1" />
                      </div>
                      <p className="text-sm font-medium">Live Video Session</p>
                    </div>
                    
                    {/* Floating Elements */}
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                      className="absolute top-4 right-4 w-20 h-24 bg-gray-800 rounded-lg border border-gray-700"
                    />
                  </div>

                  {/* Mock Payment */}
                  <div className="flex items-center justify-between bg-green-50 rounded-xl p-3">
                    <span className="text-sm text-green-800 font-medium">Pay with M-Pesa</span>
                    <span className="text-green-600 text-sm">Instant</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Badge */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 hidden sm:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 text-xl">💰</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Earn Money</p>
                  <p className="text-xs text-gray-500">Teach what you know</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};