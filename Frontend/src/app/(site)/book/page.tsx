import type { Metadata } from 'next';
import { SitePage } from '@/components/site/CrownBarberShopWebsite';
import { pageTitle } from '@/lib/routes';

export const metadata: Metadata = { title: pageTitle('/book') };

export default function Page() {
  return <SitePage route="/book" />;
}
