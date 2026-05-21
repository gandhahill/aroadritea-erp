# POS Discretionary Discounts Runbook

**Last reviewed:** 2026-05-22
**Owner:** Operations, Director, Promotion Manager

This runbook covers one-off POS discounts that are approved operationally but are not permanent promotions in `Settings > Promotions`.

## When to use

Use this flow only when an authorized person approves a special discount for a specific transaction, event, complaint handling, VIP visit, or operational exception.

Do not use this flow for recurring campaigns. Recurring campaigns must be created in `Settings > Promotions`.

## Cashier steps

1. Open `POS > Kasir POS`.
2. Add the ordered products and variants.
3. On the affected cart line, open the discount controls.
4. Choose a quick percentage or enter the discount amount.
5. Fill the reason clearly. Example format: `Approved by <name> for <reason>`.
6. Continue payment only after the reason is filled.
7. Print receipt/label as usual.

The system blocks payment when a manual line discount has no reason.

## Governance

- The discount reason is saved on the sale line.
- The discount is summarized in the sale audit payload.
- A promotion application record is created with `manual_line_discount`.
- Users with `promotion.manage` permission receive a notification after the sale.
- Demo POS has the same UI behavior for training, but remains client-side only.

## Review steps for promotion owners

1. Open `Notifications`.
2. Review manual discount notifications.
3. Compare the reason, cashier, item, and sale number.
4. If the pattern repeats, create a real promotion rule in `Settings > Promotions`.
5. If the discount was unauthorized, follow the POS incident workflow and audit the sale.

## Controls

- Do not hardcode special customer labels or personal names in code.
- Do not use manual discounts to bypass product pricing or tax settings.
- Do not create permanent promotions from cashier-only POS context.
- Refunds and voids still require their own recorded reason.

