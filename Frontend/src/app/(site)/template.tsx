'use client';

// The design's page transition (CrownBarberShopWebsite.tsx motion.main): fade up on each
// new page, none on first load (the design's AnimatePresence initial={false}).
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { EASE } from '@/components/ui';
import { useReducedMotion } from '@/lib/motion';

let loaded = false;

export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [animate] = useState(() => loaded);
  useEffect(() => {
    loaded = true;
  }, []);
  return <motion.main id="main" initial={animate ? {
    opacity: 0,
    y: reduce ? 0 : 8
  } : false} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    duration: 0.3,
    ease: EASE
  }}>
      {children}
    </motion.main>;
}
