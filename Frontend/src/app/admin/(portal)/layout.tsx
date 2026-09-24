import { CrownShopAdmin } from '@/components/admin/CrownShopAdmin';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <CrownShopAdmin>{children}</CrownShopAdmin>;
}
