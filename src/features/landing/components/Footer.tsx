import React from 'react';
import { Logo } from '../../../shared/components/Logo';

export const Footer: React.FC = () => {
  const links = [
    { label: 'Platform', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'For tutors', href: '#tutors' },
    { label: 'Trust', href: '#trust' },
  ];

  return (
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <Logo size="sm" />
            <p className="mt-4 text-sm leading-6 text-gray-600">
              Q-over-o is a tutoring platform for discovering tutors, booking sessions, managing wallet activity, and supporting tutor qualification progress.
            </p>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
            {links.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-semibold text-gray-600 transition-colors hover:text-indigo-600">
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t pt-6 md:flex-row md:items-center">
          <p className="text-sm text-gray-500">
            © 2026 Q-over-o. All rights reserved.
          </p>
          <p className="text-sm text-gray-500">Built for transparent tutoring workflows.</p>
        </div>
      </div>
    </footer>
  );
};
