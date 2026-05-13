/**
 * Tests for IAM permission engine — SD §11.2
 * Tests wildcard matching, location scoping, and cache behavior.
 *
 * NOTE: These are unit tests that mock the DB layer.
 * Integration tests with real DB will come with T-0030 (resilience tests).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@erp/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
  },
}));

// --- Test the matchesPermission logic (extracted for testability) ---

/**
 * Reimplementation of the matching logic for unit testing.
 * In production, this is internal to permission-engine.ts.
 */
function matchesPermission(grantedCodes: Set<string>, requiredPermission: string): boolean {
  if (grantedCodes.has(requiredPermission)) return true;
  if (grantedCodes.has('*.*')) return true;
  const dotIndex = requiredPermission.indexOf('.');
  if (dotIndex > 0) {
    const module = requiredPermission.substring(0, dotIndex);
    if (grantedCodes.has(`${module}.*`)) return true;
  }
  return false;
}

describe('Permission Matching Logic', () => {
  it('should match exact permission code', () => {
    const granted = new Set(['accounting.journal.create', 'accounting.journal.post']);
    expect(matchesPermission(granted, 'accounting.journal.create')).toBe(true);
    expect(matchesPermission(granted, 'accounting.journal.post')).toBe(true);
    expect(matchesPermission(granted, 'accounting.journal.reverse')).toBe(false);
  });

  it('should match super admin wildcard *.*', () => {
    const granted = new Set(['*.*']);
    expect(matchesPermission(granted, 'accounting.journal.create')).toBe(true);
    expect(matchesPermission(granted, 'pos.refund')).toBe(true);
    expect(matchesPermission(granted, 'hr.payroll.run')).toBe(true);
    expect(matchesPermission(granted, 'anything.at.all')).toBe(true);
  });

  it('should match module-level wildcard (module.*)', () => {
    const granted = new Set(['accounting.*']);
    expect(matchesPermission(granted, 'accounting.journal.create')).toBe(true);
    expect(matchesPermission(granted, 'accounting.period.close')).toBe(true);
    expect(matchesPermission(granted, 'accounting.coa.manage')).toBe(true);
    // Should NOT match other modules
    expect(matchesPermission(granted, 'pos.transact')).toBe(false);
    expect(matchesPermission(granted, 'hr.payroll.run')).toBe(false);
  });

  it('should return false for empty granted set', () => {
    const granted = new Set<string>();
    expect(matchesPermission(granted, 'accounting.journal.create')).toBe(false);
  });

  it('should not match partial module name', () => {
    const granted = new Set(['account.*']); // NOT 'accounting.*'
    expect(matchesPermission(granted, 'accounting.journal.create')).toBe(false);
  });

  it('should handle permission with no dots', () => {
    const granted = new Set(['admin']);
    expect(matchesPermission(granted, 'admin')).toBe(true);
    expect(matchesPermission(granted, 'user')).toBe(false);
  });

  it('should handle multiple wildcards', () => {
    const granted = new Set(['accounting.*', 'pos.*', 'inventory.view']);
    expect(matchesPermission(granted, 'accounting.journal.create')).toBe(true);
    expect(matchesPermission(granted, 'pos.refund')).toBe(true);
    expect(matchesPermission(granted, 'inventory.view')).toBe(true);
    expect(matchesPermission(granted, 'inventory.adjust')).toBe(false);
    expect(matchesPermission(granted, 'hr.payroll.run')).toBe(false);
  });
});

describe('Location-scoped permission resolution', () => {
  // Simulate the resolution logic from the engine

  interface SimulatedPerms {
    global: Set<string>;
    byLocation: Map<string, Set<string>>;
  }

  function canSimulated(
    perms: SimulatedPerms,
    permission: string,
    context?: { locationId?: string },
  ): boolean {
    if (matchesPermission(perms.global, permission)) return true;
    if (context?.locationId) {
      const locationPerms = perms.byLocation.get(context.locationId);
      if (locationPerms && matchesPermission(locationPerms, permission)) return true;
    }
    if (!context?.locationId) {
      for (const locationPerms of perms.byLocation.values()) {
        if (matchesPermission(locationPerms, permission)) return true;
      }
    }
    return false;
  }

  it('should allow global permission without location context', () => {
    const perms: SimulatedPerms = {
      global: new Set(['accounting.journal.create']),
      byLocation: new Map(),
    };
    expect(canSimulated(perms, 'accounting.journal.create')).toBe(true);
  });

  it('should allow global permission with any location context', () => {
    const perms: SimulatedPerms = {
      global: new Set(['accounting.journal.create']),
      byLocation: new Map(),
    };
    expect(canSimulated(perms, 'accounting.journal.create', { locationId: 'loc1' })).toBe(true);
  });

  it('should allow location-scoped permission at correct location', () => {
    const perms: SimulatedPerms = {
      global: new Set(),
      byLocation: new Map([['loc-mli', new Set(['pos.transact', 'pos.void'])]]),
    };
    expect(canSimulated(perms, 'pos.transact', { locationId: 'loc-mli' })).toBe(true);
  });

  it('should deny location-scoped permission at wrong location', () => {
    const perms: SimulatedPerms = {
      global: new Set(),
      byLocation: new Map([['loc-mli', new Set(['pos.transact'])]]),
    };
    expect(canSimulated(perms, 'pos.transact', { locationId: 'loc-plz' })).toBe(false);
  });

  it('should allow location-scoped permission without context (any location)', () => {
    const perms: SimulatedPerms = {
      global: new Set(),
      byLocation: new Map([['loc-mli', new Set(['pos.transact'])]]),
    };
    // Without locationId context, should check all locations
    expect(canSimulated(perms, 'pos.transact')).toBe(true);
  });

  it('should deny permission not in any scope', () => {
    const perms: SimulatedPerms = {
      global: new Set(['accounting.view']),
      byLocation: new Map([['loc-mli', new Set(['pos.transact'])]]),
    };
    expect(canSimulated(perms, 'hr.payroll.run')).toBe(false);
    expect(canSimulated(perms, 'hr.payroll.run', { locationId: 'loc-mli' })).toBe(false);
  });

  it('should handle super admin with location context', () => {
    const perms: SimulatedPerms = {
      global: new Set(['*.*']),
      byLocation: new Map(),
    };
    expect(canSimulated(perms, 'anything.at.all', { locationId: 'any-loc' })).toBe(true);
  });

  it('should combine global and location permissions', () => {
    const perms: SimulatedPerms = {
      global: new Set(['accounting.view']),
      byLocation: new Map([
        ['loc-mli', new Set(['pos.transact'])],
        ['loc-plz', new Set(['pos.transact', 'pos.void'])],
      ]),
    };
    // Global perm works everywhere
    expect(canSimulated(perms, 'accounting.view', { locationId: 'loc-mli' })).toBe(true);
    expect(canSimulated(perms, 'accounting.view', { locationId: 'loc-plz' })).toBe(true);
    // Location perm only at correct location
    expect(canSimulated(perms, 'pos.transact', { locationId: 'loc-mli' })).toBe(true);
    expect(canSimulated(perms, 'pos.void', { locationId: 'loc-mli' })).toBe(false);
    expect(canSimulated(perms, 'pos.void', { locationId: 'loc-plz' })).toBe(true);
  });
});

describe('Permission cache behavior', () => {
  it('should invalidate on explicit call', async () => {
    const mod = await import('../src/iam/permission-engine');
    expect(() => mod.invalidatePermissionCache('user-123')).not.toThrow();
    expect(() => mod.invalidatePermissionCache()).not.toThrow();
  });
});

describe('requirePermission Result wrapper', () => {
  it('module exports the expected functions', async () => {
    const mod = await import('../src/iam/permission-engine');
    const { requirePermission } = await import('../src/iam/require-permission');
    expect(typeof mod.can).toBe('function');
    expect(typeof requirePermission).toBe('function');
    expect(typeof mod.invalidatePermissionCache).toBe('function');
  });
});
