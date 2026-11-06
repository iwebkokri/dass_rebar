'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { submitWith } from './ToolsSubmit';
import { createUser, resetUserPassword, type UserFormState } from '@/app/admin/users/actions';

type RoleOpt = { value: string; label: string; help: string };

/** Generated password is displayed exactly once (it only exists in this action result — it is never stored in clear text). */
function PasswordOnce({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="sc-users-secret">
      <span className="sc-label">Password (shown only once — copy it now)</span>
      <div className="sc-users-secret-row">
        <code>{password}</code>
        <button
          type="button"
          className="sc-btn sc-btn-sm"
          onClick={() => {
            navigator.clipboard?.writeText(password).then(() => setCopied(true), () => setCopied(false));
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <span className="sc-help">Send it to the user privately. They can change it under “My profile”.</span>
    </div>
  );
}

function PasswordChoice({ manual, setManual, idPrefix }: { manual: boolean; setManual: (v: boolean) => void; idPrefix: string }) {
  return (
    <div className="sc-field is-wide">
      <span className="sc-label">Password</span>
      <div className="sc-users-radios">
        <label className="sc-check"><input type="radio" name="password_mode" value="generate" checked={!manual} onChange={() => setManual(false)} /> Generate a strong password</label>
        <label className="sc-check"><input type="radio" name="password_mode" value="manual" checked={manual} onChange={() => setManual(true)} /> I’ll type one</label>
      </div>
      {manual && (
        <>
          <input className="sc-input" id={`${idPrefix}-pw`} name="password" type="text" autoComplete="off" minLength={10} maxLength={200} required style={{ maxWidth: 360 }} aria-label="Password" />
          <span className="sc-help">At least 10 characters, with three of: lower-case, upper-case, digits, symbols (or 16+ characters).</span>
        </>
      )}
    </div>
  );
}

export function UsersCreateForm({ roles }: { roles: RoleOpt[] }) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(createUser, {});
  const [manual, setManual] = useState(false);
  const [role, setRole] = useState('editor');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  // controlled fields: React clears uncontrolled ones after every submit, which would lose what was typed when validation fails
  useEffect(() => {
    if (state.done) { setEmail(''); setName(''); setManual(false); }
  }, [state.done]);
  const help = roles.find((r) => r.value === role)?.help;

  return (
    <form onSubmit={submitWith(action)} className="sc-card sc-form">
      {state.error && <div className="sc-flash sc-flash-err is-wide" role="alert" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>{state.error}</div>}
      {state.done && (
        <div className="sc-flash sc-flash-ok" role="status" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          <strong>{state.done.message}</strong>
          {state.done.password && <PasswordOnce password={state.done.password} />}
          <div className="sc-users-done-links">
            <Link className="sc-rowlink" href="/admin/users">Back to all users</Link>
            {state.done.id ? <Link className="sc-rowlink" href={`/admin/users/${state.done.id}`}>Edit this user</Link> : null}
          </div>
        </div>
      )}
      <div className="sc-field"><label htmlFor="u-email">Email</label><input className="sc-input" id="u-email" name="email" type="email" autoComplete="off" maxLength={200} required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="sc-field"><label htmlFor="u-name">Name</label><input className="sc-input" id="u-name" name="name" type="text" autoComplete="off" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="sc-field is-wide">
        <label htmlFor="u-role">Role</label>
        <select className="sc-select" id="u-role" name="role" value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: 260 }}>
          {roles.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
        </select>
        {help && <span className="sc-help">{help}</span>}
      </div>
      <PasswordChoice key={state.done ? `done-${state.done.email}` : 'form'} manual={manual} setManual={setManual} idPrefix="u" />
      <div className="sc-form-actions">
        <button className="sc-btn sc-btn-primary" type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add user'}</button>
        <Link className="sc-btn" href="/admin/users">Cancel</Link>
      </div>
    </form>
  );
}

export function UsersResetForm({ id }: { id: number }) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(resetUserPassword.bind(null, id), {});
  const [manual, setManual] = useState(false);
  return (
    <form onSubmit={submitWith(action)} className="sc-card sc-form">
      <h2 style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Reset password</h2>
      {state.error && <div className="sc-flash sc-flash-err" role="alert" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>{state.error}</div>}
      {state.done && (
        <div className="sc-flash sc-flash-ok" role="status" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          <strong>{state.done.message}</strong>
          {state.done.password && <PasswordOnce password={state.done.password} />}
        </div>
      )}
      <PasswordChoice key={state.done ? 'done' : 'form'} manual={manual} setManual={setManual} idPrefix="r" />
      <div className="sc-form-actions">
        <button className="sc-btn" type="submit" disabled={pending}>{pending ? 'Updating…' : 'Set new password'}</button>
        <span className="sc-muted">They will be signed out everywhere.</span>
      </div>
    </form>
  );
}
