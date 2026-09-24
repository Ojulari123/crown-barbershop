import { redirect } from 'next/navigation';

// Unknown admin screens open Today, as the design's hash router did.
export default function UnknownAdminScreen() {
  redirect('/admin/today');
}
