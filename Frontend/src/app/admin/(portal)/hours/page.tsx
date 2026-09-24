import type { Metadata } from 'next';
import { AdminScreen } from '@/components/admin/CrownShopAdmin';

export const metadata: Metadata = { title: 'Hours & notices' };

export default function Page() {
  return <AdminScreen view="hours" />;
}
