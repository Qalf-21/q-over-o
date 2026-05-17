import React from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck, Calendar, GraduationCap, Search, WalletCards } from 'lucide-react';
import { useInView } from 'framer-motion';

export const HowItWorks: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const studentSteps = [
    {
      icon: Search,
      title: "Find a tutor",
      desc: "Browse tutor profiles by subject and review available information before choosing a session."
    },
    {
      icon: Calendar,
      title: "Book and prepare",
      desc: "Select a time, confirm session details, and keep your learning activity organized."
    },
    {
      icon: BookOpenCheck,
      title: "Track progress",
      desc: "Use history, reviews, and wallet records to understand your learning and spending over time."
    }
  ];

  const tutorSteps = [
    {
      icon: GraduationCap,
      title: "Create tutor presence",
      desc: "Set up tutor information, subjects, availability, and profile details for learners to evaluate."
    },
    {
      icon: Calendar,
      title: "Manage sessions",
      desc: "Accept, complete, and review tutoring activity through the tutor dashboard workflow."
    },
    {
      icon: WalletCards,
      title: "Build reputation",
      desc: "Track earnings, ratings, completed hours, and qualification progress as your tutoring record grows."
    }
  ];

  return (
    <section id="how-it-works" ref={ref} className="bg-gray-950 py-20 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">How Q-over-o works</h2>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-gray-400">
            The platform separates learner and tutor workflows while keeping account access, session records, and payments consistent.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          {[
            { heading: 'For students', items: studentSteps },
            { heading: 'For tutors', items: tutorSteps },
          ].map((group, groupIndex) => (
            <motion.div
              key={group.heading}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: groupIndex * 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
            >
              <h3 className="text-xl font-bold">{group.heading}</h3>
              <div className="mt-6 space-y-4">
                {group.items.map((item) => (
                  <div key={item.title} className="flex gap-4 rounded-xl bg-white/[0.04] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{item.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
