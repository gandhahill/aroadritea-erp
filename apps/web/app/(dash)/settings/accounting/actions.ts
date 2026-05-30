import { eq } from 'drizzle-orm';
import { db } from '@erp/db';
import { cmsSettings } from '@erp/db/schema';
import { getCurrentUser } from '@erp/services/auth';
import { auditLogService } from '@erp/services/audit';
import { DEFAULT_POSTING_ACCOUNTS } from '@erp/services/accounting/posting-accounts';
import { resolveAccountIdsByCodes } from '@erp/services/accounting';

export async function saveAccountingSettingsAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const tenantId = user.tenantId;

    // Extract all accounts
    const formKeys = Array.from(formData.keys());
    const accounts: Record<string, string> = {};
    let hasValues = false;

    for (const key of formKeys) {
      if (key.startsWith('accounts.')) {
        const value = formData.get(key)?.toString().trim();
        if (value) {
          const mapKey = key.replace('accounts.', '');
          accounts[mapKey] = value;
          hasValues = true;
        }
      }
    }

    if (!hasValues) {
      throw new Error('No account mappings provided');
    }

    // Merge with defaults for validation
    const mergedMapping = { ...DEFAULT_POSTING_ACCOUNTS, ...accounts };

    // Validate that all codes actually exist in DB
    const allCodesToValidate = Object.values(mergedMapping);
    const resolvedIds = await resolveAccountIdsByCodes(allCodesToValidate, tenantId);

    // If any code failed to resolve, it doesn't exist
    for (const [purpose, code] of Object.entries(mergedMapping)) {
      if (!resolvedIds[code]) {
        throw new Error(`Account code ${code} (for ${purpose}) does not exist or is inactive.`);
      }
    }

    // Load existing to get previous state for audit
    const existingRow = await db.query.cmsSettings.findFirst({
      where: eq(cmsSettings.key, 'accounting_posting_map'),
    });

    let prevJson = null;

    if (existingRow) {
      try {
        prevJson = typeof existingRow.value === 'string' ? JSON.parse(existingRow.value) : existingRow.value;
      } catch (e) {
        prevJson = existingRow.value;
      }

      await db
        .update(cmsSettings)
        .set({
          value: JSON.stringify(accounts),
          updatedAt: new Date(),
          updatedByUserId: user.id,
        })
        .where(eq(cmsSettings.key, 'accounting_posting_map'));
    } else {
      await db.insert(cmsSettings).values({
        key: 'accounting_posting_map',
        value: JSON.stringify(accounts),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByUserId: user.id,
        updatedByUserId: user.id,
        locationId: null,
      });
    }

    // Backward compatibility: AP setting used by purchase-invoice-service
    if (accounts.purchasingAp) {
      const apAccountId = resolvedIds[accounts.purchasingAp];
      if (apAccountId) {
        const apRow = await db.query.cmsSettings.findFirst({
          where: eq(cmsSettings.key, 'accounting_settings'),
        });

        if (apRow) {
          let apSettings: any = {};
          try {
             apSettings = typeof apRow.value === 'string' ? JSON.parse(apRow.value) : apRow.value;
          } catch(e) {}
          apSettings.apAccountId = apAccountId;
          await db.update(cmsSettings).set({
            value: JSON.stringify(apSettings),
            updatedAt: new Date(),
            updatedByUserId: user.id,
          }).where(eq(cmsSettings.key, 'accounting_settings'));
        } else {
          await db.insert(cmsSettings).values({
            key: 'accounting_settings',
            value: JSON.stringify({ apAccountId }),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdByUserId: user.id,
            updatedByUserId: user.id,
            locationId: null,
          });
        }
      }
    }


    await auditLogService.log({
      tenantId,
      locationId: null,
      userId: user.id,
      entityType: 'cms_settings',
      entityId: 'accounting_posting_map',
      action: existingRow ? 'UPDATE' : 'CREATE',
      beforeJson: prevJson,
      afterJson: accounts,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error saving posting mapping:', error);
    return { success: false, error: error.message || 'Failed to save mapping' };
  }
}
