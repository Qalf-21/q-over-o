import React from 'react';
import { motion } from 'framer-motion';
import { Users, MessageCircle, Clock } from 'lucide-react';
import { useInView } from 'framer-motion';

export const Problem: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const problems = [
    {
      icon: Users,
      title: "Classes Are Too Big",
      desc: "One lecturer. 300 students. You can't ask questions."
    },
    {
      icon: MessageCircle,
      title: "WhatsApp Groups Are Messy",
      desc: "Messages get lost. Wrong answers spread fast."
    },
    {
      icon: Clock,
      title: "You Get Stuck at Night",
      desc: "Office hours are over. Exams are coming. Now what?"
    }
  ];

  return (
    <section ref={ref} className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Studying Shouldn't Be This Hard
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Campus life is tough. Getting help should be easy.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, index) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-6">
                <problem.icon className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{problem.title}</h3>
              <p className="text-gray-600 leading-relaxed">{problem.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};