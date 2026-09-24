import type { Metadata } from 'next';
import { AdminScreen } from '@/components/admin/CrownShopAdmin';

export const metadata: Metadata = { title: 'Bookings' };

export default function Page() {
  return <AdminScreen view="bookings" />;
}
