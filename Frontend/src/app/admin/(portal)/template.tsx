'use client';

// The design's screen transition (CrownShopAdmin.tsx motion.div): a short fade on each
// screen change, none for the first screen after sign-in (AnimatePresence initial={false}).
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/components/admin/kit';

let loaded = false;

export default function PortalTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [animate] = useState(() => loaded);
  useEffect(() => {
    loaded = true;
  }, []);
  return <motion.div initial={animate ? {
    opacity: 0,
    y: reduce ? 0 : 4
  } : false} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    duration: 0.2,
    ease: EASE
  }}>
      {children}
    </motion.div>;
}
