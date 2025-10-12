import { redirect } from 'next/navigation';
import { auth } from '../(auth)/auth';
import { CRMContent } from './crm-content';

export default async function CRMPage() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  return <CRMContent />;
}
