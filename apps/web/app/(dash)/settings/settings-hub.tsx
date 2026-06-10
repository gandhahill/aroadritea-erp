import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@erp/services/iam';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export type SettingsGroupId =
  | 'organization'
  | 'salesPos'
  | 'automation'
  | 'accessSecurity'
  | 'integrationsAi';

type PermissionState = {
  global: string[];
  byLocation: Record<string, string[]>;
};

type SettingsHubItem = {
  href: string;
  labelKey: string;
  descriptionKey: string;
  permission?: string;
  alwaysVisible?: boolean;
};

type SettingsHubGroup = {
  id: SettingsGroupId;
  href: string;
  titleKey: string;
  descriptionKey: string;
  items: SettingsHubItem[];
};

const SETTINGS_GROUPS: SettingsHubGroup[] = [
  {
    id: 'organization',
    href: '/settings/organization',
    titleKey: 'groups.organization.title',
    descriptionKey: 'groups.organization.description',
    items: [
      {
        href: '/settings/company',
        labelKey: 'items.company.title',
        descriptionKey: 'items.company.description',
        permission: 'settings.manage',
      },
      {
        href: '/settings/locations',
        labelKey: 'items.locations.title',
        descriptionKey: 'items.locations.description',
        permission: 'iam.manage_locations',
      },
      {
        href: '/settings/bank-accounts',
        labelKey: 'items.bankAccounts.title',
        descriptionKey: 'items.bankAccounts.description',
        permission: 'settings.bank_accounts',
      },
      {
        href: '/settings/accounting',
        labelKey: 'items.accounting.title',
        descriptionKey: 'items.accounting.description',
        permission: 'settings.manage',
      },
    ],
  },
  {
    id: 'salesPos',
    href: '/settings/sales-pos',
    titleKey: 'groups.salesPos.title',
    descriptionKey: 'groups.salesPos.description',
    items: [
      {
        href: '/settings/pos',
        labelKey: 'items.pos.title',
        descriptionKey: 'items.pos.description',
        permission: 'settings.manage',
      },
      {
        href: '/settings/promotions',
        labelKey: 'items.promotions.title',
        descriptionKey: 'items.promotions.description',
        permission: 'promotion.manage',
      },
      {
        href: '/settings/loyalty',
        labelKey: 'items.loyalty.title',
        descriptionKey: 'items.loyalty.description',
        permission: 'settings.manage',
      },
    ],
  },
  {
    id: 'automation',
    href: '/settings/automation',
    titleKey: 'groups.automation.title',
    descriptionKey: 'groups.automation.description',
    items: [
      {
        href: '/settings/attendance',
        labelKey: 'items.attendance.title',
        descriptionKey: 'items.attendance.description',
        permission: 'settings.manage',
      },
      {
        href: '/settings/scheduled-jobs',
        labelKey: 'items.scheduledJobs.title',
        descriptionKey: 'items.scheduledJobs.description',
        permission: 'settings.manage',
      },
      {
        href: '/settings/notifications',
        labelKey: 'items.notifications.title',
        descriptionKey: 'items.notifications.description',
        permission: 'settings.manage',
      },
      {
        href: '/settings/custom-fields',
        labelKey: 'items.customFields.title',
        descriptionKey: 'items.customFields.description',
        permission: 'settings.manage',
      },
      {
        href: '/settings/workflow-editor',
        labelKey: 'items.workflowEditor.title',
        descriptionKey: 'items.workflowEditor.description',
        permission: 'workflow.view',
      },
    ],
  },
  {
    id: 'accessSecurity',
    href: '/settings/access-security',
    titleKey: 'groups.accessSecurity.title',
    descriptionKey: 'groups.accessSecurity.description',
    items: [
      {
        href: '/account',
        labelKey: 'items.account.title',
        descriptionKey: 'items.account.description',
        alwaysVisible: true,
      },
      {
        href: '/audit',
        labelKey: 'items.audit.title',
        descriptionKey: 'items.audit.description',
        permission: 'audit',
      },
      {
        href: '/settings/permissions',
        labelKey: 'items.permissions.title',
        descriptionKey: 'items.permissions.description',
        permission: 'iam.manage_permissions',
      },
      {
        href: '/settings/mcp-tokens',
        labelKey: 'items.mcpTokens.title',
        descriptionKey: 'items.mcpTokens.description',
        permission: 'settings.manage',
      },
    ],
  },
  {
    id: 'integrationsAi',
    href: '/settings/integrations',
    titleKey: 'groups.integrationsAi.title',
    descriptionKey: 'groups.integrationsAi.description',
    items: [
      {
        href: '/settings/integrations/naixer',
        labelKey: 'items.naixer.title',
        descriptionKey: 'items.naixer.description',
        permission: 'settings.manage',
      },
      {
        href: '/settings/ai-assistant',
        labelKey: 'items.aiAssistant.title',
        descriptionKey: 'items.aiAssistant.description',
        permission: 'ai.assistant.admin',
      },
      {
        href: '/settings/ai-assistant/log',
        labelKey: 'items.aiLog.title',
        descriptionKey: 'items.aiLog.description',
        permission: 'ai.assistant.admin',
      },
    ],
  },
];

function hasAccess(permission: string | undefined, permissions: PermissionState): boolean {
  if (!permission) return true;

  const matches = (granted: string[]) => {
    if (granted.includes('*.*')) return true;
    if (granted.includes(permission)) return true;

    const parts = permission.split('.');
    let current = '';
    for (const part of parts) {
      current += current ? `.${part}` : part;
      if (granted.includes(`${current}.*`)) return true;
    }

    return granted.some((p) => p.startsWith(`${permission}.`));
  };

  if (matches(permissions.global)) return true;
  return Object.values(permissions.byLocation).some((locationPermissions) =>
    matches(locationPermissions),
  );
}

function visibleItems(group: SettingsHubGroup, permissions: PermissionState) {
  return group.items.filter(
    (item) => item.alwaysVisible || hasAccess(item.permission, permissions),
  );
}

export async function SettingsHub({ groupId }: { groupId?: SettingsGroupId }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const [t, permissions] = await Promise.all([
    getTranslations('settings.hub'),
    getUserPermissions(String(session.user.id)),
  ]);

  const groups = SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: visibleItems(group, permissions),
  })).filter((group) => group.items.length > 0 && (!groupId || group.id === groupId));

  const currentGroup = groupId ? SETTINGS_GROUPS.find((group) => group.id === groupId) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={<>{currentGroup ? t(currentGroup.titleKey) : t('title')}</>}
        description={<>{currentGroup ? t(currentGroup.descriptionKey) : t('subtitle')}</>}
      />

      {groupId ? (
        <Link
          href="/settings"
          className="inline-flex items-center rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm font-semibold text-brand-ink-2 transition-colors hover:border-brand-red/30 hover:text-brand-red"
        >
          {t('allGroups')}
        </Link>
      ) : null}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-brand-cream-3 bg-card p-6">
          <p className="font-semibold text-brand-ink">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-brand-ink-3">{t('emptyDescription')}</p>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => (
            <section key={group.id} id={group.id} className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold text-brand-ink">
                    {t(group.titleKey)}
                  </h2>
                  <p className="mt-1 text-sm text-brand-ink-3">{t(group.descriptionKey)}</p>
                </div>
                {!groupId ? (
                  <Link
                    href={group.href}
                    className="text-sm font-semibold text-brand-red hover:text-brand-red-dark"
                  >
                    {t('openGroup')}
                  </Link>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-xl border border-brand-cream-3 bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-red/30 hover:shadow-pop"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-brand-ink group-hover:text-brand-red">
                          {t(item.labelKey)}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-brand-ink-3">
                          {t(item.descriptionKey)}
                        </p>
                      </div>
                      <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red transition-colors group-hover:bg-brand-red group-hover:text-white">
                        <svg
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                          />
                        </svg>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
