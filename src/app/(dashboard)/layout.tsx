import { cookies } from 'next/headers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reading cookies opts the entire route into dynamic rendering,
  // preventing static prerendering of auth-dependent pages.
  await cookies();

  return <>{children}</>;
}
