import React from 'react';
import { motion } from 'framer-motion';
import { Search, Video, Wallet } from 'lucide-react';
import { useInView } from 'framer-motion';

export const Solution: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const solutions = [
    {
      icon: Search,
      title: "Find Help Fast",
      desc: "Search for your subject. Get matched in 2 minutes."
    },
    {
      icon: Video,
      title: "Learn From Your Phone",
      desc: "Video calls with whiteboard. Study in your room."
    },
    {
      icon: Wallet,
      title: "Earn Money Teaching",
      desc: "Good at math? Teach others. Cash out to M-Pesa."
    }
  ];

  return (
    <section ref={ref} className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              We Fixed It. <br />
              <span className="text-indigo-600">Simple. Fast. Safe.</span>
            </h2>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Q-over-o connects you with students who can help. 
              No more waiting. No more confusion. Just learn.
            </p>
            <ul className="space-y-4">
              {[
                "Verified campus tutors only",
                "Pay only after the lesson",
                "Works on any phone"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-700">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <div className="grid gap-6">
            {solutions.map((solution, index) => (
              <motion.div
                key={solution.title}
                initial={{ opacity: 0, x: 30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex items-start gap-4 p-6 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-all"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <solution.icon className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{solution.title}</h3>
                  <p className="text-gray-600">{solution.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};