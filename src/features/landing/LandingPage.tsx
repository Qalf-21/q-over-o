import React from 'react';
import { Navigation } from './components/Navigation';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Features } from './components/Features';
import { DualRole } from './components/DualRole';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <DualRole />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};
