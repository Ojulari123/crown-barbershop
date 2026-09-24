import type { Metadata } from 'next';
import { AdminScreen } from '@/components/admin/CrownShopAdmin';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return <AdminScreen view="settings" />;
}
