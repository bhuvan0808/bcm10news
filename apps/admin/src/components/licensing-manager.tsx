'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoryRow, ContentLicenseRow, OrganizationRow } from '@bcm10/database';
import { Button, Field, Input, cn } from '@bcm10/ui';
import {
  addOrganizationMember,
  createLicense,
  createOrganization,
  removeOrganizationMember,
  resetLicensePeriod,
  setLicenseActive,
} from '@/lib/actions/licensing';
import { formatDate } from '@/lib/format';

interface Member {
  organizationId: string;
  profileId: string;
  email: string;
  name: string;
}

/**
 * B2B licensing.
 *
 * The screen is organised around the quota, because that is the thing that
 * causes phone calls: an organisation whose licence has run out stops being
 * served content mid-month and nobody knows why. The quota bar turns amber at
 * 75% and red at 90%, so it is visible before the call.
 */
export function LicensingManager({
  organizations,
  licenses,
  categories,
  members,
  usageByOrg,
}: {
  organizations: OrganizationRow[];
  licenses: ContentLicenseRow[];
  categories: CategoryRow[];
  members: Member[];
  usageByOrg: Record<string, number>;
}) {
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [licenseFor, setLicenseFor] = useState<OrganizationRow | null>(null);

  return (
    <div className="mx-auto max-w-(--container-page)">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Licensing</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Organisations that pay to use BCM10 reporting.
          </p>
        </div>
        <Button onClick={() => setShowOrgForm(true)}>Add an organisation</Button>
      </header>

      {!organizations.length ? (
        <div className="mt-6 rounded-sm border border-dashed border-rule p-10 text-center">
          <p className="font-semibold text-ink">No licensing customers yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Add an organisation, give it a licence with a monthly article quota, then add the people
            at that company who will read under it.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {organizations.map((org) => (
            <OrganizationCard
              key={org.id}
              organization={org}
              licenses={licenses.filter((l) => l.organization_id === org.id)}
              members={members.filter((m) => m.organizationId === org.id)}
              usage={usageByOrg[org.id] ?? 0}
              onAddLicense={() => setLicenseFor(org)}
            />
          ))}
        </ul>
      )}

      {showOrgForm ? <OrganizationDialog onClose={() => setShowOrgForm(false)} /> : null}
      {licenseFor ? (
        <LicenseDialog
          organization={licenseFor}
          categories={categories}
          onClose={() => setLicenseFor(null)}
        />
      ) : null}
    </div>
  );
}

function OrganizationCard({
  organization,
  licenses,
  members,
  usage,
  onAddLicense,
}: {
  organization: OrganizationRow;
  licenses: ContentLicenseRow[];
  members: Member[];
  usage: number;
  onAddLicense: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [memberEmail, setMemberEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(result.message ?? 'That did not work.');
    });
  };

  return (
    <li className="rounded-sm border border-rule bg-paper-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">{organization.name}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{organization.billing_email}</p>
          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-faint">
            {organization.gstin ? <span>GSTIN {organization.gstin}</span> : null}
            <span aria-hidden="true">·</span>
            <span>{members.length} seats</span>
            <span aria-hidden="true">·</span>
            <span>{usage} accesses in 30 days</span>
          </p>
        </div>

        <Button size="sm" variant="outline" onClick={onAddLicense}>
          Add a licence
        </Button>
      </div>

      {licenses.length ? (
        <ul className="mt-4 space-y-2">
          {licenses.map((license) => (
            <LicenseRow key={license.id} license={license} onAct={act} pending={pending} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-sm bg-paper-sunk p-3 text-sm text-ink-muted">
          No licence yet — this organisation cannot read anything beyond the free site.
        </p>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-ink-muted hover:text-ink">
          Seats ({members.length})
        </summary>

        <ul className="mt-2 space-y-1">
          {members.map((member) => (
            <li key={member.profileId} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-ink">
                {member.name || member.email}
                {member.name ? (
                  <span className="ml-1.5 text-xs text-ink-faint">{member.email}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() =>
                  act(() => removeOrganizationMember(organization.id, member.profileId))
                }
                className="shrink-0 text-xs font-semibold text-brand hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex gap-2">
          <Input
            value={memberEmail}
            onChange={(event) => setMemberEmail(event.target.value)}
            placeholder="their@company.com"
            type="email"
          />
          <Button
            size="md"
            variant="outline"
            loading={pending}
            className="shrink-0"
            onClick={() =>
              act(async () => {
                const result = await addOrganizationMember(organization.id, memberEmail);
                if (result.ok) setMemberEmail('');
                return result;
              })
            }
          >
            Add seat
          </Button>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          They need an account on the public site first — adding a seat links an existing reader, it
          does not create one.
        </p>
      </details>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-brand">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function LicenseRow({
  license,
  onAct,
  pending,
}: {
  license: ContentLicenseRow;
  onAct: (fn: () => Promise<{ ok: boolean; message?: string }>) => void;
  pending: boolean;
}) {
  const unlimited = license.quota_per_period === null;
  const used = license.used_this_period;
  const quota = license.quota_per_period ?? 0;
  const percent = unlimited ? 0 : Math.min(100, (used / Math.max(quota, 1)) * 100);

  // Amber before it becomes a problem, red before it becomes a phone call.
  const tone =
    percent >= 90 ? 'bg-brand' : percent >= 75 ? 'bg-status-changes' : 'bg-status-approved';

  const expired = license.period_end ? new Date(license.period_end) < new Date() : false;

  return (
    <li
      className={cn(
        'rounded-sm border p-3',
        license.is_active && !expired ? 'border-rule' : 'border-rule bg-paper-sunk/60 opacity-70'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {license.name}
            {!license.is_active ? (
              <span className="ml-2 rounded-xs bg-paper-sunk px-1.5 py-0.5 text-[10px] font-bold text-ink-muted uppercase">
                Suspended
              </span>
            ) : null}
            {expired ? (
              <span className="ml-2 rounded-xs bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                Expired
              </span>
            ) : null}
          </p>

          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-faint">
            <span>since {formatDate(license.period_start)}</span>
            {license.period_end ? (
              <>
                <span aria-hidden="true">·</span>
                <span>ends {formatDate(license.period_end)}</span>
              </>
            ) : null}
          </p>

          <p className="mt-1 flex flex-wrap gap-1.5">
            {license.allow_full_text ? <Perm>Full text</Perm> : null}
            {license.allow_images ? <Perm>Images</Perm> : null}
            {license.allow_republish ? <Perm>Republish</Perm> : null}
            {license.allow_api ? <Perm>API</Perm> : null}
            {license.allowed_category_ids.length ? (
              <Perm>{license.allowed_category_ids.length} sections only</Perm>
            ) : (
              <Perm>All sections</Perm>
            )}
          </p>
        </div>

        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() => onAct(() => resetLicensePeriod(license.id))}
          >
            Reset period
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() => onAct(() => setLicenseActive(license.id, !license.is_active))}
          >
            {license.is_active ? 'Suspend' : 'Reactivate'}
          </Button>
        </div>
      </div>

      <div className="mt-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-ink-muted">
            {unlimited ? 'Unlimited' : `${used} of ${quota} articles this period`}
          </span>
          {!unlimited ? (
            <span
              className={cn(
                'font-semibold tabular-nums',
                percent >= 90 ? 'text-brand' : 'text-ink-muted'
              )}
            >
              {Math.round(percent)}%
            </span>
          ) : null}
        </div>

        {!unlimited ? (
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-sunk"
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={quota}
            aria-label={`${license.name} quota`}
          >
            <div
              className={cn('h-full rounded-full', tone)}
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Perm({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-xs bg-paper-sunk px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
      {children}
    </span>
  );
}

function OrganizationDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', billingEmail: '', gstin: '', contactPhone: '' });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createOrganization({
        name: form.name,
        billingEmail: form.billingEmail,
        gstin: form.gstin || undefined,
        contactPhone: form.contactPhone || undefined,
        billingAddress: {},
      });

      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.message ?? 'Could not add that organisation.');
      }
    });
  };

  return (
    <Dialog title="Add an organisation" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Company name" htmlFor="orgName" required>
          <Input
            id="orgName"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            autoFocus
          />
        </Field>

        <Field label="Billing email" htmlFor="orgEmail" required hint="Where invoices go.">
          <Input
            id="orgEmail"
            type="email"
            value={form.billingEmail}
            onChange={(event) => setForm({ ...form, billingEmail: event.target.value })}
            required
          />
        </Field>

        <Field label="GSTIN" htmlFor="orgGstin" hint="Needed on a tax invoice in India.">
          <Input
            id="orgGstin"
            value={form.gstin}
            onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })}
            placeholder="36AABCU9603R1ZM"
          />
        </Field>

        <Field label="Contact phone" htmlFor="orgPhone">
          <Input
            id="orgPhone"
            value={form.contactPhone}
            onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
          />
        </Field>

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
            Add organisation
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function LicenseDialog({
  organization,
  categories,
  onClose,
}: {
  organization: OrganizationRow;
  categories: CategoryRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [form, setForm] = useState({
    name: '',
    quota: 100,
    periodEnd: '',
    allowFullText: true,
    allowImages: false,
    allowRepublish: false,
    allowApi: false,
    allowedCategoryIds: [] as string[],
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createLicense({
        organizationId: organization.id,
        name: form.name,
        quotaPerPeriod: unlimited ? null : form.quota,
        periodEnd: form.periodEnd || null,
        allowFullText: form.allowFullText,
        allowImages: form.allowImages,
        allowRepublish: form.allowRepublish,
        allowApi: form.allowApi,
        allowedCategoryIds: form.allowedCategoryIds,
      });

      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.message ?? 'Could not create the licence.');
      }
    });
  };

  const toggleCategory = (id: string) =>
    setForm({
      ...form,
      allowedCategoryIds: form.allowedCategoryIds.includes(id)
        ? form.allowedCategoryIds.filter((existing) => existing !== id)
        : [...form.allowedCategoryIds, id],
    });

  return (
    <Dialog title={`New licence for ${organization.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Licence name" htmlFor="licName" required hint="How it appears on an invoice.">
          <Input
            id="licName"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Standard — 100 articles/month"
            required
            autoFocus
          />
        </Field>

        <div>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={unlimited}
              onChange={(event) => setUnlimited(event.target.checked)}
              className="size-4 accent-[var(--color-brand)]"
            />
            Unlimited articles
          </label>

          {!unlimited ? (
            <Field label="Articles per period" htmlFor="licQuota" className="mt-3">
              <Input
                id="licQuota"
                type="number"
                min={1}
                value={form.quota}
                onChange={(event) => setForm({ ...form, quota: Number(event.target.value) })}
              />
            </Field>
          ) : null}
        </div>

        <Field
          label="Licence ends"
          htmlFor="licEnd"
          hint="Leave blank for an open-ended agreement."
        >
          <Input
            id="licEnd"
            type="date"
            value={form.periodEnd}
            onChange={(event) => setForm({ ...form, periodEnd: event.target.value })}
          />
        </Field>

        <fieldset className="rounded-sm border border-rule p-3">
          <legend className="px-1 text-xs font-bold tracking-wider text-ink-muted uppercase">
            What they may do
          </legend>

          {(
            [
              ['allowFullText', 'Read the full text', 'Otherwise headline and summary only.'],
              ['allowImages', 'Use our photographs', 'Check agency rights before granting this.'],
              [
                'allowRepublish',
                'Republish on their own site',
                'A syndication right, not a reading right.',
              ],
              ['allowApi', 'Access by API', 'For automated ingestion.'],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="mt-2 flex items-start gap-2.5 text-sm first:mt-0">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                className="mt-0.5 size-4 accent-[var(--color-brand)]"
              />
              <span>
                {label}
                <span className="block text-xs text-ink-faint">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="rounded-sm border border-rule p-3">
          <legend className="px-1 text-xs font-bold tracking-wider text-ink-muted uppercase">
            Sections
          </legend>
          <p className="mb-2 text-xs text-ink-faint">
            Select none for the whole site. Selecting some restricts the licence to those desks.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories
              .filter((category) => !category.parent_id)
              .map((category) => {
                const selected = form.allowedCategoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    aria-pressed={selected}
                    className={cn(
                      'rounded-sm px-2 py-1 text-xs font-medium',
                      selected
                        ? 'bg-brand text-white'
                        : 'bg-paper-sunk text-ink-muted hover:bg-rule'
                    )}
                  >
                    {category.name}
                  </button>
                );
              })}
          </div>
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
            Create licence
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
