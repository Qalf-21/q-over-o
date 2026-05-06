import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { useInView } from 'framer-motion';

export const Testimonials: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const testimonials = [
    {
      name: "Brian O.",
      year: "3rd Year, Engineering",
      text: "I was failing Calculus 2. Found a tutor at 9pm before my exam. Passed with a B+. This app saved my semester.",
      role: "tutee"
    },
    {
      name: "Grace M.",
      year: "4th Year, Computer Science",
      text: "I make money between classes teaching Python. Pays for my food and wifi. Easy to use.",
      role: "tutor"
    },
    {
      name: "Daniel K.",
      year: "2nd Year, Medicine",
      text: "Better than WhatsApp groups. The video quality is good even on campus WiFi. Highly recommend.",
      role: "tutee"
    }
  ];

  return (
    <section ref={ref} className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Students Love Us
          </h2>
          <p className="text-lg text-gray-600">Real students. Real results.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-gray-50 rounded-2xl p-8 relative"
            >
              <Quote className="w-10 h-10 text-indigo-200 absolute top-4 right-4" />
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">"{item.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold">
                  {item.name[0]}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.year}</div>
                </div>
                <span className={`ml-auto text-xs px-3 py-1 rounded-full ${
                  item.role === 'tutor' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {item.role === 'tutor' ? 'Tutor' : 'Student'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 border-t pt-12"
        >
          {[
            { label: "Sessions Done", value: "2,000+" },
            { label: "Happy Students", value: "800+" },
            { label: "Tutors Earning", value: "150+" },
            { label: "Universities", value: "12" }
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};