import { headers } from 'next/headers';
import { CrownBarberShopWebsite } from '@/components/site/CrownBarberShopWebsite';
import { fetchPublicState } from '@/lib/publicState';
import { CrownProvider } from '@/lib/store';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { state, now } = await fetchPublicState((await headers()).get('x-forwarded-for'));
  return (
    <CrownProvider initial={state} now={now}>
      <CrownBarberShopWebsite>{children}</CrownBarberShopWebsite>
    </CrownProvider>
  );
}
