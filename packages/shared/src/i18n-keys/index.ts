/**
 * i18n key constants — namespaces and key helpers.
 * SD §7.1: i18n key format = `module.section.label`
 *
 * These are type-safe references for i18n keys, not the translated strings.
 * Actual translations live in apps/web/messages/{id,en,zh}.json.
 */

export type I18nNamespace =
  | 'common'
  | 'accounting'
  | 'pos'
  | 'inventory'
  | 'purchasing'
  | 'hr'
  | 'payroll'
  | 'crm'
  | 'tax'
  | 'reporting'
  | 'kitchen'
  | 'cms'
  | 'settings'
  | 'auth';

// --- Common keys used across modules ---

export const COMMON_KEYS = {
  actions: {
    save: 'common.actions.save',
    cancel: 'common.actions.cancel',
    delete: 'common.actions.delete',
    edit: 'common.actions.edit',
    create: 'common.actions.create',
    search: 'common.actions.search',
    filter: 'common.actions.filter',
    export: 'common.actions.export',
    print: 'common.actions.print',
    confirm: 'common.actions.confirm',
    back: 'common.actions.back',
    submit: 'common.actions.submit',
    reset: 'common.actions.reset',
  },
  status: {
    active: 'common.status.active',
    inactive: 'common.status.inactive',
    draft: 'common.status.draft',
    posted: 'common.status.posted',
    reversed: 'common.status.reversed',
    pending: 'common.status.pending',
    approved: 'common.status.approved',
    rejected: 'common.status.rejected',
  },
  labels: {
    name: 'common.labels.name',
    description: 'common.labels.description',
    date: 'common.labels.date',
    amount: 'common.labels.amount',
    total: 'common.labels.total',
    status: 'common.labels.status',
    location: 'common.labels.location',
    createdAt: 'common.labels.createdAt',
    updatedAt: 'common.labels.updatedAt',
    createdBy: 'common.labels.createdBy',
  },
  errors: {
    required: 'common.errors.required',
    notFound: 'common.errors.notFound',
    forbidden: 'common.errors.forbidden',
    conflict: 'common.errors.conflict',
    serverError: 'common.errors.serverError',
    validationFailed: 'common.errors.validationFailed',
  },
  pagination: {
    page: 'common.pagination.page',
    of: 'common.pagination.of',
    next: 'common.pagination.next',
    previous: 'common.pagination.previous',
    showing: 'common.pagination.showing',
  },
} as const;

export const ACCOUNTING_KEYS = {
  journal: {
    title: 'accounting.journal.title',
    create: 'accounting.journal.create',
    post: 'accounting.journal.post',
    reverse: 'accounting.journal.reverse',
    postingDate: 'accounting.journal.postingDate',
    description: 'accounting.journal.description',
    debit: 'accounting.journal.debit',
    credit: 'accounting.journal.credit',
    totalDebit: 'accounting.journal.totalDebit',
    totalCredit: 'accounting.journal.totalCredit',
    notBalanced: 'accounting.journal.notBalanced',
    periodClosed: 'accounting.journal.periodClosed',
  },
  coa: {
    title: 'accounting.coa.title',
    code: 'accounting.coa.code',
    name: 'accounting.coa.name',
    type: 'accounting.coa.type',
    normalBalance: 'accounting.coa.normalBalance',
    parent: 'accounting.coa.parent',
    isPostable: 'accounting.coa.isPostable',
  },
  period: {
    title: 'accounting.period.title',
    open: 'accounting.period.open',
    close: 'accounting.period.close',
    closed: 'accounting.period.closed',
    startDate: 'accounting.period.startDate',
    endDate: 'accounting.period.endDate',
  },
} as const;

export const AUTH_KEYS = {
  login: {
    title: 'auth.login.title',
    email: 'auth.login.email',
    password: 'auth.login.password',
    submit: 'auth.login.submit',
    invalidCredentials: 'auth.login.invalidCredentials',
    suspended: 'auth.login.suspended',
  },
  roles: {
    title: 'auth.roles.title',
    permissions: 'auth.roles.permissions',
  },
} as const;
