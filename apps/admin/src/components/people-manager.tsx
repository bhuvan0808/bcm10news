'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileRow, UserRole } from '@bcm10/database';
import { Button, Field, Input, cn } from '@bcm10/ui';
import {
  createStaffAccount,
  deleteStaffAccount,
  resetStaffPassword,
  setStaffActive,
  updateStaffAccount,
  type CreatedStaff,
} from '@/lib/actions/people';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '@/lib/roles';
import { formatDate, formatRelative } from '@/lib/format';

/**
 * Staff management.
 *
 * The distinction this screen is built around: **deactivate, do not delete**.
 * `articles.author_id` is ON DELETE RESTRICT, so an account that has filed
 * anything cannot be removed — and should not be, because the byline is part of
 * the published record. Delete is offered only for an account with no stories,
 * and the UI says why when it is not available.
 */
export function PeopleManager({
  staff,
  currentUserId,
  storyCounts,
}: {
  staff: ProfileRow[];
  currentUserId: string;
  storyCounts: Record<string, number>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [credentials, setCredentials] = useState<CreatedStaff | null>(null);
  const [editing, setEditing] = useState<ProfileRow | null>(null);

  const active = staff.filter((person) => person.is_active);
  const inactive = staff.filter((person) => !person.is_active);

  return (
    <div className="mx-auto max-w-(--container-page)">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">People</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {active.length} active {active.length === 1 ? 'account' : 'accounts'}
            {inactive.length ? ` · ${inactive.length} deactivated` : ''}
          </p>
        </div>

        <Button onClick={() => setShowCreate(true)}>Add someone</Button>
      </header>

      {credentials ? (
        <CredentialsPanel created={credentials} onDismiss={() => setCredentials(null)} />
      ) : null}

      <section className="mt-6">
        <h2 className="border-b border-rule pb-2 text-xs font-bold tracking-wider text-ink-muted uppercase">
          Active
        </h2>
        <ul className="divide-y divide-rule">
          {active.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              isSelf={person.id === currentUserId}
              storyCount={storyCounts[person.id] ?? 0}
              onEdit={() => setEditing(person)}
              onCredentials={setCredentials}
            />
          ))}
        </ul>
      </section>

      {inactive.length ? (
        <section className="mt-10">
          <h2 className="border-b border-rule pb-2 text-xs font-bold tracking-wider text-ink-muted uppercase">
            Deactivated
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            These accounts cannot sign in. Their published stories are untouched.
          </p>
          <ul className="divide-y divide-rule">
            {inactive.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                isSelf={person.id === currentUserId}
                storyCount={storyCounts[person.id] ?? 0}
                onEdit={() => setEditing(person)}
                onCredentials={setCredentials}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {showCreate ? (
        <CreateStaffDialog
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setCredentials(created);
            setShowCreate(false);
          }}
        />
      ) : null}

      {editing ? <EditStaffDialog person={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function PersonRow({
  person,
  isSelf,
  storyCount,
  onEdit,
  onCredentials,
}: {
  person: ProfileRow;
  isSelf: boolean;
  storyCount: number;
  onEdit: () => void;
  onCredentials: (created: CreatedStaff) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(result.message ?? 'That did not work.');
    });
  };

  const canDelete = storyCount === 0 && !isSelf;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">
              {person.display_name || person.full_name}
              {isSelf ? (
                <span className="ml-1.5 text-xs font-normal text-ink-faint">(you)</span>
              ) : null}
            </p>
            <RoleBadge role={person.role} />
            {person.must_change_password ? (
              <span className="bg-status-changes/15 text-status-changes rounded-xs px-1.5 py-0.5 text-[10px] font-bold uppercase">
                Password not set
              </span>
            ) : null}
            {person.can_publish && person.role === 'reporter' ? (
              <span className="bg-status-published/15 text-status-published rounded-xs px-1.5 py-0.5 text-[10px] font-bold uppercase">
                Can publish
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 text-sm text-ink-muted">{person.email}</p>

          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-faint">
            {person.designation ? <span>{person.designation}</span> : null}
            <span aria-hidden="true">·</span>
            <span>
              {storyCount} {storyCount === 1 ? 'story' : 'stories'}
            </span>
            <span aria-hidden="true">·</span>
            <span>added {formatDate(person.created_at)}</span>
            {person.last_seen_at ? (
              <>
                <span aria-hidden="true">·</span>
                <span>last seen {formatRelative(person.last_seen_at)}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>

          {person.is_active ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                loading={pending}
                onClick={() =>
                  act(async () => {
                    const result = await resetStaffPassword(person.id);
                    if (result.ok && result.data) {
                      onCredentials({
                        profileId: person.id,
                        email: person.email,
                        temporaryPassword: result.data.password,
                        emailed: false,
                      });
                    }
                    return result;
                  })
                }
              >
                Reset password
              </Button>

              {!isSelf ? (
                <Button
                  size="sm"
                  variant="outline"
                  loading={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Deactivate ${person.display_name || person.full_name}? They will be signed out and unable to sign back in. Their stories stay published.`
                      )
                    ) {
                      act(() => setStaffActive(person.id, false));
                    }
                  }}
                >
                  Deactivate
                </Button>
              ) : null}
            </>
          ) : (
            <Button
              size="sm"
              loading={pending}
              onClick={() => act(() => setStaffActive(person.id, true))}
            >
              Reactivate
            </Button>
          )}

          {canDelete ? (
            <Button
              size="sm"
              variant="danger"
              loading={pending}
              onClick={() => {
                if (window.confirm(`Permanently delete ${person.email}? This cannot be undone.`)) {
                  act(() => deleteStaffAccount(person.id));
                }
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-brand">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const tone: Partial<Record<UserRole, string>> = {
    super_admin: 'bg-brand text-white',
    managing_editor: 'bg-status-review/15 text-status-review',
    editor: 'bg-status-submitted/15 text-status-submitted',
    reporter: 'bg-paper-sunk text-ink-muted',
    photographer: 'bg-paper-sunk text-ink-muted',
    subscription_manager: 'bg-premium-bg text-premium',
  };

  return (
    <span
      className={cn(
        'rounded-xs px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
        tone[role] ?? 'bg-paper-sunk text-ink-muted'
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

/**
 * The one moment the temporary password is visible.
 *
 * Shown on screen rather than only emailed, because email may not be configured
 * and a reporter is often standing next to the editor creating their account.
 * It is never stored anywhere we can read back — Supabase hashes it — so
 * dismissing this panel really is the last chance.
 */
function CredentialsPanel({
  created,
  onDismiss,
}: {
  created: CreatedStaff;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `Newsroom: ${window.location.origin}/sign-in\nEmail: ${created.email}\nTemporary password: ${created.temporaryPassword}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable; the text is on screen anyway */
    }
  };

  return (
    <section
      role="status"
      className="border-status-approved bg-status-approved/5 mt-5 rounded-sm border-2 p-4"
    >
      <h2 className="text-status-approved text-sm font-bold">Account ready</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {created.emailed
          ? 'The details have been emailed. They are shown here once in case it does not arrive.'
          : 'Email is not configured, so pass these on yourself.'}{' '}
        <strong className="text-ink">This password will not be shown again.</strong>
      </p>

      <dl className="mt-3 rounded-sm bg-paper-raised p-3 font-mono text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-ink-faint">Email</dt>
          <dd className="min-w-0 break-all text-ink">{created.email}</dd>
        </div>
        <div className="mt-1.5 flex gap-2">
          <dt className="w-20 shrink-0 text-ink-faint">Password</dt>
          <dd className="min-w-0 font-bold break-all text-ink">{created.temporaryPassword}</dd>
        </div>
      </dl>

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy details'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </section>
  );
}

function CreateStaffDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (created: CreatedStaff) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    role: 'reporter' as (typeof ASSIGNABLE_ROLES)[number]['value'],
    designation: '',
    phone: '',
    canPublish: false,
    canSendPush: false,
    canManageMedia: false,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createStaffAccount(form);
      if (result.ok && result.data) {
        onCreated(result.data);
        router.refresh();
      } else {
        setError(result.message ?? 'Could not create the account.');
      }
    });
  };

  const roleInfo = ASSIGNABLE_ROLES.find((role) => role.value === form.role);

  return (
    <Dialog title="Add someone to the newsroom" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" htmlFor="fullName" required>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            required
            autoFocus
          />
        </Field>

        <Field
          label="Email"
          htmlFor="staffEmail"
          required
          hint="They sign in with this. It cannot be changed later without support."
        >
          <Input
            id="staffEmail"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </Field>

        <Field label="Role" htmlFor="role" required hint={roleInfo?.description}>
          <select
            id="role"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as typeof form.role })}
            className="h-10 w-full rounded-sm border border-rule-strong bg-paper-raised px-2 text-sm"
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Designation" htmlFor="designation" hint="Shown on their public author page.">
          <Input
            id="designation"
            value={form.designation}
            onChange={(event) => setForm({ ...form, designation: event.target.value })}
            placeholder="Senior Correspondent, Telangana"
          />
        </Field>

        <Field label="Phone" htmlFor="phone">
          <Input
            id="phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>

        {form.role === 'reporter' ? (
          <fieldset className="rounded-sm border border-rule p-3">
            <legend className="px-1 text-xs font-bold tracking-wider text-ink-muted uppercase">
              Extra permissions
            </legend>

            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.canPublish}
                onChange={(event) => setForm({ ...form, canPublish: event.target.checked })}
                className="mt-0.5 size-4 accent-[var(--color-brand)]"
              />
              <span>
                Can publish directly
                <span className="block text-xs text-ink-faint">
                  Skips editor review. Give this only to someone senior — a reporter without it must
                  submit, which is the default and usually the right one.
                </span>
              </span>
            </label>

            <label className="mt-2 flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.canSendPush}
                onChange={(event) => setForm({ ...form, canSendPush: event.target.checked })}
                className="mt-0.5 size-4 accent-[var(--color-brand)]"
              />
              <span>
                Can send push notifications
                <span className="block text-xs text-ink-faint">
                  Breaking alerts reach every subscribed device and cannot be recalled.
                </span>
              </span>
            </label>
          </fieldset>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-brand">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-rule pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Create account
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function EditStaffDialog({ person, onClose }: { person: ProfileRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: person.display_name ?? '',
    role: person.role,
    designation: person.designation ?? '',
    phone: person.phone ?? '',
    bio: person.bio ?? '',
    canPublish: person.can_publish,
    canSendPush: person.can_send_push,
    canManageMedia: person.can_manage_media_library,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateStaffAccount({ profileId: person.id, ...form });
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.message ?? 'Could not save.');
      }
    });
  };

  return (
    <Dialog title={`Edit ${person.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Display name" htmlFor="displayName" hint="How the byline reads.">
          <Input
            id="displayName"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
        </Field>

        <Field label="Role" htmlFor="editRole">
          <select
            id="editRole"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
            className="h-10 w-full rounded-sm border border-rule-strong bg-paper-raised px-2 text-sm"
          >
            {person.role === 'super_admin' ? (
              <option value="super_admin">Super admin</option>
            ) : null}
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Designation" htmlFor="editDesignation">
          <Input
            id="editDesignation"
            value={form.designation}
            onChange={(event) => setForm({ ...form, designation: event.target.value })}
          />
        </Field>

        <Field label="Phone" htmlFor="editPhone">
          <Input
            id="editPhone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>

        <Field label="Bio" htmlFor="editBio" hint="Shown on their public author page.">
          <textarea
            id="editBio"
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
            rows={3}
            className="w-full resize-y rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 text-sm"
          />
        </Field>

        <fieldset className="rounded-sm border border-rule p-3">
          <legend className="px-1 text-xs font-bold tracking-wider text-ink-muted uppercase">
            Permissions
          </legend>

          {(
            [
              ['canPublish', 'Can publish directly'],
              ['canSendPush', 'Can send push notifications'],
              ['canManageMedia', 'Can manage the whole media library'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="mt-1.5 flex items-center gap-2.5 text-sm first:mt-0">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                className="size-4 accent-[var(--color-brand)]"
              />
              {label}
            </label>
          ))}
        </fieldset>

        {error ? (
          <p role="alert" className="text-sm font-medium text-brand">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-rule pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative my-8 w-full max-w-lg rounded-sm bg-paper-raised shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1.5 text-ink-muted hover:bg-paper-sunk"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
