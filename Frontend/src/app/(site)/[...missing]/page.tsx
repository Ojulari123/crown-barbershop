import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NOT_FOUND_TITLE } from '@/lib/routes';

// Any unknown path renders the design's 404 inside the site chrome ((site)/not-found.tsx).
export const metadata: Metadata = { title: NOT_FOUND_TITLE };

export default function Missing() {
  notFound();
}
