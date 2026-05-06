import { redirect } from 'next/navigation';

export default function HomePage() {
  // ERP root redirects to login or dashboard
  redirect('/login');
}
