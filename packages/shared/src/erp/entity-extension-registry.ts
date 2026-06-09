export const ERP_MODULES = [
  'accounting',
  'reporting',
  'tax',
  'pos',
  'inventory',
  'purchasing',
  'kitchen',
  'hr',
  'payroll',
  'crm',
  'cms',
  'logistics',
  'correspondence',
  'helpdesk',
  'settings',
  'ai',
] as const;

export type ErpModule = (typeof ERP_MODULES)[number];

export const ENTITY_EXTENSION_CAPABILITIES = [
  'customFields',
  'workflow',
  'statusLifecycle',
  'numbering',
  'attachments',
  'comments',
  'timeline',
  'import',
  'export',
  'mcp',
] as const;

export type EntityExtensionCapability = (typeof ENTITY_EXTENSION_CAPABILITIES)[number];
export type EntityCategory = 'master' | 'transaction' | 'content' | 'configuration';

export interface EntityExtensionConfig {
  entityType: string;
  module: ErpModule;
  category: EntityCategory;
  capabilities: readonly EntityExtensionCapability[];
  sensitive?: boolean;
  lifecycleEvents?: readonly string[];
}

export const ENTITY_EXTENSION_REGISTRY = [
  {
    entityType: 'account',
    module: 'accounting',
    category: 'master',
    capabilities: ['customFields', 'timeline', 'import', 'export', 'mcp'],
  },
  {
    entityType: 'partner',
    module: 'accounting',
    category: 'master',
    capabilities: ['customFields', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
  },
  {
    entityType: 'journal_entry',
    module: 'accounting',
    category: 'transaction',
    sensitive: true,
    capabilities: [
      'customFields',
      'workflow',
      'statusLifecycle',
      'numbering',
      'attachments',
      'comments',
      'timeline',
      'import',
      'export',
      'mcp',
    ],
    lifecycleEvents: ['draft', 'submitted', 'approved', 'posted', 'reversed', 'cancelled'],
  },
  {
    entityType: 'sales_invoice',
    module: 'accounting',
    category: 'transaction',
    sensitive: true,
    capabilities: [
      'customFields',
      'workflow',
      'statusLifecycle',
      'numbering',
      'attachments',
      'comments',
      'timeline',
      'export',
      'mcp',
    ],
    lifecycleEvents: ['draft', 'submitted', 'posted', 'partially_paid', 'paid', 'voided'],
  },
  {
    entityType: 'purchase_invoice',
    module: 'purchasing',
    category: 'transaction',
    sensitive: true,
    capabilities: [
      'customFields',
      'workflow',
      'statusLifecycle',
      'numbering',
      'attachments',
      'comments',
      'timeline',
      'import',
      'export',
      'mcp',
    ],
    lifecycleEvents: ['draft', 'matched', 'approved', 'posted', 'paid', 'cancelled'],
  },
  {
    entityType: 'petty_cash_transaction',
    module: 'accounting',
    category: 'transaction',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'approved', 'posted', 'rejected', 'cancelled'],
  },
  {
    entityType: 'reimbursement_request',
    module: 'accounting',
    category: 'transaction',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'submitted', 'approved', 'rejected', 'disbursed', 'cancelled'],
  },
  {
    entityType: 'fixed_asset',
    module: 'accounting',
    category: 'master',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'active', 'disposed', 'written_off'],
  },
  {
    entityType: 'product',
    module: 'inventory',
    category: 'master',
    capabilities: ['customFields', 'workflow', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
  },
  {
    entityType: 'recipe_bom',
    module: 'inventory',
    category: 'master',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'active', 'inactive', 'superseded'],
  },
  {
    entityType: 'stock_adjustment',
    module: 'inventory',
    category: 'transaction',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'numbering', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'submitted', 'approved', 'posted', 'rejected', 'cancelled'],
  },
  {
    entityType: 'stock_transfer',
    module: 'inventory',
    category: 'transaction',
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'numbering', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'submitted', 'approved', 'in_transit', 'received', 'cancelled'],
  },
  {
    entityType: 'stock_opname',
    module: 'inventory',
    category: 'transaction',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'numbering', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'counting', 'submitted', 'approved', 'posted', 'cancelled'],
  },
  {
    entityType: 'purchase_order',
    module: 'purchasing',
    category: 'transaction',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'numbering', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'submitted', 'approved', 'ordered', 'partially_received', 'closed', 'cancelled'],
  },
  {
    entityType: 'goods_receipt',
    module: 'purchasing',
    category: 'transaction',
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'numbering', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'received', 'posted', 'cancelled'],
  },
  {
    entityType: 'purchase_return',
    module: 'purchasing',
    category: 'transaction',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'numbering', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'submitted', 'approved', 'posted', 'cancelled'],
  },
  {
    entityType: 'sales_order',
    module: 'pos',
    category: 'transaction',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'numbering', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['open', 'parked', 'paid', 'voided', 'refunded', 'synced'],
  },
  {
    entityType: 'employee',
    module: 'hr',
    category: 'master',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
  },
  {
    entityType: 'leave_request',
    module: 'hr',
    category: 'transaction',
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'submitted', 'approved', 'rejected', 'cancelled'],
  },
  {
    entityType: 'overtime_request',
    module: 'hr',
    category: 'transaction',
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'submitted', 'approved', 'rejected', 'cancelled'],
  },
  {
    entityType: 'payroll_run',
    module: 'payroll',
    category: 'transaction',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'numbering', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'calculated', 'approved', 'paid', 'cancelled'],
  },
  {
    entityType: 'member',
    module: 'crm',
    category: 'master',
    sensitive: true,
    capabilities: ['customFields', 'workflow', 'comments', 'timeline', 'import', 'export', 'mcp'],
  },
  {
    entityType: 'complaint',
    module: 'crm',
    category: 'transaction',
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['open', 'in_progress', 'resolved', 'closed', 'reopened'],
  },
  {
    entityType: 'outgoing_shipment',
    module: 'logistics',
    category: 'transaction',
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'numbering', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'booked', 'in_transit', 'delivered', 'exception', 'cancelled'],
  },
  {
    entityType: 'cms_page',
    module: 'cms',
    category: 'content',
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'attachments', 'comments', 'timeline', 'import', 'export', 'mcp'],
    lifecycleEvents: ['draft', 'review', 'published', 'archived'],
  },
  {
    entityType: 'helpdesk_ticket',
    module: 'helpdesk',
    category: 'transaction',
    capabilities: ['customFields', 'workflow', 'statusLifecycle', 'attachments', 'comments', 'timeline', 'export', 'mcp'],
    lifecycleEvents: ['open', 'triaged', 'in_progress', 'resolved', 'closed'],
  },
] as const satisfies readonly EntityExtensionConfig[];

export type ExtensibleEntityType = (typeof ENTITY_EXTENSION_REGISTRY)[number]['entityType'];

export function getEntityExtensionConfig(entityType: string): EntityExtensionConfig | undefined {
  return ENTITY_EXTENSION_REGISTRY.find((entity) => entity.entityType === entityType);
}

export function listEntityExtensionConfigs(
  predicate?: (entity: EntityExtensionConfig) => boolean,
): EntityExtensionConfig[] {
  return predicate ? ENTITY_EXTENSION_REGISTRY.filter(predicate) : [...ENTITY_EXTENSION_REGISTRY];
}

export function listEntitiesByCapability(capability: EntityExtensionCapability): EntityExtensionConfig[] {
  return listEntityExtensionConfigs((entity) => entity.capabilities.includes(capability));
}

export function hasEntityCapability(
  entityType: string,
  capability: EntityExtensionCapability,
): boolean {
  return getEntityExtensionConfig(entityType)?.capabilities.includes(capability) ?? false;
}
