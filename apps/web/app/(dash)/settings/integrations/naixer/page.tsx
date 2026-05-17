/**
 * Naixer KDS Integration Settings — SD §33.7, ADR-0007
 * Manage product/modifier code mappings and QR format config.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  fetchFormatConfigs,
  fetchModifierCodes,
  fetchNaixerModifierOptions,
  fetchNaixerProductOptions,
  fetchProductCodes,
} from './actions';
import { FormatConfigForm } from './format-config-form';
import { ModifierCodesTable } from './modifier-codes-table';
import { ProductCodesTable } from './product-codes-table';

export const metadata: Metadata = {
  title: 'Naixer KDS — Integrations — Settings',
};

export default async function NaixerKdsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';

  const [productCodes, modifierCodes, formatConfigs, productOptions, modifierOptions] =
    await Promise.all([
      fetchProductCodes(tenantId),
      fetchModifierCodes(tenantId),
      fetchFormatConfigs(tenantId),
      fetchNaixerProductOptions(tenantId),
      fetchNaixerModifierOptions(tenantId),
    ]);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Naixer KDS Integration</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Manage product code mappings, modifier code mappings, and QR format configuration for
            the Naixer tea machine.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
            {productCodes.filter((p) => p.isActive).length} products
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cream-2 px-3 py-1 text-xs font-medium text-brand-ink-3">
            {modifierCodes.filter((m) => m.isActive).length} modifiers
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <svg
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-gold"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-brand-ink">QR Code Integration</p>
            <p className="mt-0.5 text-xs text-brand-ink-2">
              Each product and modifier must be mapped to a Naixer vendor code. Cup labels include a
              scannable Naixer QR, pickup number, order time, and product details. Format B (dash)
              is the default: e.g.{' '}
              <code className="rounded bg-brand-cream-2 px-1 py-0.5 text-[11px] font-mono">
                T003-C01-S02-W01
              </code>
            </p>
          </div>
        </div>
      </div>

      {/* Format Config */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-brand-ink">QR Format Configuration</h2>
        <FormatConfigForm configs={formatConfigs} />
      </section>

      {/* Product Codes */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-brand-ink">Product Code Mappings</h2>
        <ProductCodesTable
          codes={productCodes}
          tenantId={tenantId}
          products={productOptions.products}
          variants={productOptions.variants}
        />
      </section>

      {/* Modifier Codes */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-brand-ink">Modifier Code Mappings</h2>
        <ModifierCodesTable
          codes={modifierCodes}
          tenantId={tenantId}
          modifierOptions={modifierOptions}
        />
      </section>
    </div>
  );
}
