# POS Legacy Parity Runbook

**Last reviewed:** 2026-05-22
**Source checked:** `D:\KERJA\Aroadri Tea\Foto\POS`

This document maps visible features from the old POS photos to the ERP POS and adjacent modules.

## Mapped features

| Old POS feature seen in photos | ERP location | Status |
|---|---|---|
| Product grid and category tabs | `POS > Kasir POS` | Implemented |
| Variant/modifier selection | `POS > Kasir POS` item controls | Implemented |
| Member lookup | `POS > Kasir POS` member panel | Implemented |
| Quantity update | `POS > Kasir POS` cart line | Implemented |
| Manual discount | `POS > Kasir POS` cart line discount | Implemented with reason and notification |
| Pending/order list | `POS > Pesanan` | Implemented |
| New order | `POS > Kasir POS` | Implemented |
| Send to kitchen/label | POS sale + label print/KDS QR | Implemented |
| Payment | `POS > Kasir POS` payment modal | Implemented |
| Refund/partial refund | `POS > Pesanan` | Implemented |
| Receipt print | POS receipt print route | Implemented |
| Label print | POS label print route | Implemented |
| Reports | `Reporting` and POS shortcut to reports | Implemented |
| Stock management | `Inventory > Stock`, `Stock Opname`, `Quick Adjustment` | Implemented |
| Manual daily closing from old POS | `POS > Input Penjualan Manual` | Implemented |
| Promotions | `Settings > Promotions` | Implemented |
| POS settings | `Settings > POS` | Implemented |

## Intentionally controlled differences

| Old POS feature | ERP decision |
|---|---|
| Open item | Not exposed as a cashier free-text sale because it bypasses product, BOM, tax, and reporting controls. Create a proper product/service or use manual closing for legacy POS totals. |
| Tax exempt cashier toggle | Not exposed as a cashier toggle. Retail F&B tax follows configured PBJT/PB1 and tax rules. Exceptions belong in tax configuration, not ad hoc cashier actions. |
| Purchase gift/gift card | CRM loyalty/voucher infrastructure exists, but selling gift cards from POS should be enabled only after finance defines revenue recognition and liability accounts. |
| Open cash drawer | Hardware-specific. Direct drawer control belongs in the future Print Bridge/device integration, not browser-only POS. |
| Production department/loss reporting/meal prep time | Current coverage is inventory adjustment, stock variance, KDS status, and Naixer settings. A dedicated production ops screen can be added if operations wants that exact workflow. |

## Verification checklist

1. Open real POS and demo POS side by side.
2. Confirm product/category/variant/price behavior matches.
3. Apply a manual discount with a reason in demo, then in real POS test/staging.
4. Confirm payment is blocked when discount reason is empty.
5. Confirm shortcut buttons open Orders, Manual Closing, Stock, Reports, Promos, and Settings.
6. Print receipt and label from both real and demo flows.
7. Confirm stock cannot be selected when explicitly tracked and zero.

