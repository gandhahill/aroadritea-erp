import { describe, expect, it } from 'vitest';
import {
  ENTITY_EXTENSION_REGISTRY,
  getEntityExtensionConfig,
  hasEntityCapability,
  listEntitiesByCapability,
} from '../src/erp/entity-extension-registry';

describe('entity extension registry', () => {
  it('keeps entity types unique', () => {
    const entityTypes = ENTITY_EXTENSION_REGISTRY.map((entity) => entity.entityType);
    expect(new Set(entityTypes).size).toBe(entityTypes.length);
  });

  it('marks sensitive transactional entities as workflow-gated and auditable by design', () => {
    const sensitiveTransactions = ENTITY_EXTENSION_REGISTRY.filter(
      (entity) => entity.sensitive && entity.category === 'transaction',
    );

    expect(sensitiveTransactions.length).toBeGreaterThan(0);
    for (const entity of sensitiveTransactions) {
      expect(entity.capabilities).toContain('workflow');
      expect(entity.capabilities).toContain('statusLifecycle');
      expect(entity.capabilities).toContain('timeline');
      expect(entity.lifecycleEvents?.length).toBeGreaterThan(1);
    }
  });

  it('exposes lookup helpers for module code and MCP tooling', () => {
    expect(getEntityExtensionConfig('purchase_order')?.module).toBe('purchasing');
    expect(hasEntityCapability('purchase_order', 'workflow')).toBe(true);
    expect(hasEntityCapability('purchase_order', 'mcp')).toBe(true);
    expect(listEntitiesByCapability('customFields').map((entity) => entity.entityType)).toContain(
      'employee',
    );
  });
});
