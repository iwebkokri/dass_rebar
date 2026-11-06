import type { Metadata } from 'next';
import Link from 'next/link';
import { UsersCreateForm } from '@/components/admin/UsersForms';
import { requireCap } from '@/lib/auth';
import { ROLES, ROLE_HELP, ROLE_LABEL } from '@/lib/roles';
import '../../../css/users.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Add user' };

export default async function NewUser() {
  await requireCap('manage_users');
  const roles = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], help: ROLE_HELP[r] }));
  return (
    <>
      <div className="sc-head">
        <div>
          <p style={{ margin: 0 }}><Link href="/admin/users" className="sc-muted">← Users</Link></p>
          <h1>Add user</h1>
        </div>
      </div>
      <UsersCreateForm roles={roles} />
    </>
  );
}
