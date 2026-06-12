# F&B ERP — "Build From Scratch" Feature Checklist

**Purpose**: This document was written **before** re-reading this repo's current
implementation, on purpose. It is an exhaustive list of features/UX details that an
Odoo/ERPNext-class ERP — used by an F&B (bubble tea / dessert) chain — would have,
imagined as if starting a new system from zero. It deliberately includes very small,
cosmetic, and "nice to have" items, because those are exactly the kind of thing that
gets skipped when planning only at the architecture level.

**Sources used**:
- Sparse clone of `odoo/odoo` @ `18.0` — `addons/{point_of_sale, pos_restaurant,
  pos_self_order, pos_loyalty, pos_hr, pos_discount, loyalty, mrp, stock, account,
  purchase, sale, sale_management, hr, hr_attendance, crm}` (227 MB,
  `E:\erp-benchmark\odoo`)
- Sparse clone of `frappe/erpnext` @ `version-15` — `accounts, stock, buying, selling,
  manufacturing, projects, assets, crm, support, quality_management, maintenance,
  subcontracting, setup, controllers, regional` (33 MB, `E:\erp-benchmark\erpnext`)
- `frappe/hrms` @ `version-15` (18 MB, `E:\erp-benchmark\hrms`)
- General trained knowledge of Odoo 17/18, ERPNext v14/v15, Loyverse, Floreant POS,
  Square/Toast restaurant feature sets, and standard SaaS/back-office UX patterns.
- Indonesian F&B operational/regulatory context already known about this business
  (PB1/PBJT, PPN opt-in, PPh21/23, BPJS, THR, GoFood/GrabFood/ShopeeFood commission,
  QRIS, multi-outlet Yogyakarta/Jakarta).

**Note on ERPNext**: core ERPNext **removed its Hospitality/Restaurant module** in
v13/v14 (`patches/v14_0/delete_hospitality_doctypes.py`). For restaurant-specific POS
(floor plan, table management, KOT, self-order kiosk), Odoo's `pos_restaurant` /
`pos_self_order` / `pos_loyalty` addons are the much stronger reference. ERPNext
remains a strong reference for back-office depth (multi-dimensional accounting,
landed cost, subcontracting, quality management, blanket orders, asset depreciation).

Every item below is phrased as a checkbox. **This file is intentionally not yet
cross-referenced against the current repo** — that happens in
`docs/benchmark/fnb-erp-gap-analysis.md` (next step). Do not assume an unchecked box
means "missing in this repo"; it means "on the from-scratch list", full stop.

---

## 0. Cross-Cutting Platform / UX Shell

### 0.1 Navigation & Search
- [ ] Global search / command palette (Ctrl+K) across products, customers, documents, employees, settings pages
- [ ] Breadcrumb trail on every page
- [ ] "Recently viewed" list per user (last ~10 records)
- [ ] Favorites / starred / pinned records (e.g. pin frequently-used reports)
- [ ] Branch/location switcher always visible in header, persists per session
- [ ] Quick-create modal ("+ New") accessible from anywhere for common entities (product, journal, PO)
- [ ] Sidebar collapse/expand + remembers state
- [ ] "What's new" changelog popover after deploy (optional, low priority)

### 0.2 Lists, Tables & Bulk Operations
- [ ] Server-side pagination + page-size selector on every list (in progress per T-0279)
- [ ] Column show/hide/reorder/resize, persisted per user per table
- [ ] Sticky table header on scroll
- [ ] Inline cell editing in list view (no need to open detail page for simple fields)
- [ ] Multi-select rows + bulk action toolbar (export, delete/archive, change status, print labels, bulk tag)
- [ ] Saved filters / custom views ("My pending approvals", "Low stock", "Overdue invoices")
- [ ] Sort/filter/page state persisted in URL (shareable, back-button safe)
- [ ] Right-click context menu on rows (open in new tab, duplicate, archive)
- [ ] Row density toggle (compact/comfortable)
- [ ] Empty-state illustration + CTA when a list has zero rows
- [ ] Loading skeletons (not just spinners) for tables/cards

### 0.3 Forms & Records
- [ ] Duplicate/clone button on master records (product, recipe, journal template, PO)
- [ ] Soft-delete everywhere with a "Trash" view + restore (audit-safe undo)
- [ ] Unsaved-changes warning when navigating away from a dirty form
- [ ] Auto-save draft for long forms (journal entry in progress, PO draft)
- [ ] Sticky save/cancel action bar on long forms (always visible while scrolling)
- [ ] Inline real-time field validation (not only on submit)
- [ ] Currency input auto-formats with thousands separators while typing ("Rp 1.000.000")
- [ ] Date range picker with presets (today/this week/this month/last month/this year/custom)
- [ ] Searchable multi-select dropdowns for long lists (products, COA accounts, employees)
- [ ] "Copy to clipboard" icon next to IDs, account numbers, links, API keys
- [ ] Avatar/profile photo upload with initials fallback (employees, members)
- [ ] Image cropping tool on photo upload (product photo, profile photo, recipe photo)

### 0.4 Activity, Notes & Attachments (generic, any record)
- [ ] Activity timeline / "chatter" on any record — system log of field changes + user comments
- [ ] @mention teammates in comments → triggers notification
- [ ] File attachments tab on any record (PO, invoice, employee, product, asset)
- [ ] Drag-and-drop file upload anywhere an attachment is allowed
- [ ] Internal/private notes (staff-only) vs. customer-visible notes distinction
- [ ] Tags/labels with custom colors, filterable across modules

### 0.5 Notifications
- [ ] In-app notification bell with unread-count badge, mark-as-read/all
- [ ] Per-user notification preferences (which events → in-app/email/WhatsApp)
- [ ] Toast/snackbar for create/update/delete actions, with "Undo" where applicable
- [ ] Confirmation dialog for destructive actions (delete/void/cancel) — no native `confirm()`
- [ ] Session-timeout warning modal with "stay logged in"

### 0.6 Theming, Print & Locale
- [ ] Dark mode / light mode / follow-system toggle
- [ ] Font-size / accessibility zoom setting
- [ ] Print-friendly stylesheet (`@media print`) on every document & report
- [ ] PDF/print template designer per document type (logo/header/footer placement, per branch)
- [ ] Reusable terms & conditions text blocks (per doc type, per language)
- [ ] Reusable email templates with placeholders for transactional emails
- [ ] Numbering-sequence configuration UI (prefix, zero-padding, reset period: yearly/monthly/never) per document type per branch
- [ ] Company profile settings page (legal name, addresses, tax IDs, logo, bank accounts) feeding all print templates
- [ ] Holiday calendar management (national + company-specific) feeding HR & scheduling
- [ ] Currency master + exchange-rate table (manual entry; scheduled fetch optional)
- [ ] Number/date format follows locale already (id/en/zh) — verify edge cases (negative numbers, large numbers)

### 0.7 Tools & Utilities
- [ ] QR code generator utility (table QR, product QR, voucher QR, asset QR)
- [ ] Barcode generator (EAN13/Code128) + label printing for products
- [ ] Label-printing templates: product shelf label, asset tag, employee badge, "fragile/halal" stickers
- [ ] Spreadsheet-style pivot table builder for ad-hoc analysis
- [ ] Scheduled report emails (daily/weekly/monthly PDF/Excel to inbox)
- [ ] Dashboard widgets: drag/resize/arrange, per-role default layouts
- [ ] "Report a bug / send feedback" widget visible to staff
- [ ] System status page for admins (DB, queue/worker, integrations up/down, last backup time)
- [ ] Sync-status indicator for offline POS (pending items count, last sync timestamp, "force sync now" button)
- [ ] API key / webhook management UI (partial via T-0293 — verify CRUD + secret rotation)
- [ ] Two-factor authentication (TOTP) for staff/admin accounts
- [ ] "Switch to demo/training mode" toggle visible to managers (ADR-0008)

---

## 1. Accounting & Finance

### 1.1 Core Ledger
- [ ] Chart of Accounts tree with drag-drop reorder, account groups/types, multi-level
- [ ] Journal entry: multi-line, attachments, save-as-template
- [ ] Recurring/scheduled journal entries (rent, depreciation, amortization) with auto-post
- [ ] Journal-entry template library ("common entries", one click to prefill)
- [ ] General ledger drill-down from trial balance / account balance to source documents
- [ ] Journal entry reversal — done; verify "schedule reversal on date X" (accruals)

### 1.2 Banking & Cash
- [ ] Multiple bank accounts per company, each mapped to a GL account
- [ ] Bank statement import (CSV/Excel/MT940/OFX)
- [ ] Bank reconciliation auto-match rules + manual match UI (in progress per T-0271)
- [ ] Cash & bank book report (running balance per account)
- [ ] Multiple petty-cash funds (per branch/per custodian), not just one global

### 1.3 Multi-Currency & Dimensions
- [ ] Foreign-currency transactions with realized/unrealized gain-loss on revaluation
- [ ] Cost center / department / project as a dimension on every journal line (flagged missing in T-0287 → F5.1)
- [ ] Multi-dimensional reporting: P&L by cost center, by branch, by both

### 1.4 Budgeting & Planning
- [ ] Annual budget by account × cost center × period
- [ ] Budget vs. actual report with variance %
- [ ] Over-budget alert/warning when posting would exceed budget

### 1.5 Fixed Assets
- [ ] Fixed asset register: acquisition cost, date, useful life, location, custodian
- [ ] Depreciation methods (straight-line minimum; declining-balance nice-to-have)
- [ ] Depreciation schedule auto-generation + auto-post monthly journals
- [ ] Asset revaluation / impairment entry
- [ ] Asset transfer between branches (with location_id update + journal if needed)
- [ ] Asset disposal wizard (sale/write-off, gain/loss calculation)
- [ ] Asset import from existing Excel list (open question in CLAUDE.md §10)

### 1.6 Accruals, Prepayments & Closing
- [ ] Prepaid expense schedule (e.g. annual insurance) with monthly amortization journals
- [ ] Deferred revenue schedule (e.g. prepaid gift cards / membership fees)
- [ ] Accrued expense/revenue with automatic reversal next period
- [ ] Year-end closing wizard: lock period, generate closing entries, roll retained earnings
- [ ] Opening-balance import wizard for go-live / new branch onboarding

### 1.7 AR/AP Operations
- [ ] Payment terms master (Net 7/14/30, COD, custom installment schedule) on customers/vendors
- [ ] Early-payment discount terms (e.g. 2/10 net 30)
- [ ] Credit limit per customer + credit-hold warning at order time
- [ ] Customer/vendor statement of account (PDF, date-ranged)
- [ ] AR/AP aging — done; verify drill-down to source invoice
- [ ] Write-off / bad-debt wizard (creates journal + marks invoice closed)
- [ ] Formal payment voucher / receipt voucher print documents (separate from journal view)
- [ ] Cheque register + cheque-printing template (if cheques still used by any vendor)
- [ ] Bank guarantee / collateral tracking (for large supplier contracts)

### 1.8 Approvals & Multi-Entity
- [ ] Multi-level payment approval matrix (extend existing approval-gate framework to payments)
- [ ] Consolidated financial statements across branches/companies (future multi-entity)
- [ ] Intercompany transactions + elimination entries (future multi-entity)

### 1.9 Defaults & Reporting
- [ ] Default GL account mapping per product category (auto revenue/COGS/inventory account on new product)
- [ ] Financial ratio dashboard (current ratio, gross margin %, net margin %, inventory turnover)
- [ ] Expense claim — done; verify mileage/per-diem rate tables exist

---

## 2. Tax & Indonesian Compliance

- [ ] PB1/PBJT engine — done, verify per-branch rate override
- [ ] PPN engine (opt-in) — done partial, verify B2B invoice flow end-to-end
- [ ] PPh21 (employee income tax) — verify **TER (Tarif Efektif Rata-rata)** monthly method per PMK 168/2023
- [ ] PPh23/26 withholding — done
- [ ] PPh4(2) final tax (building rent, construction services) — for office/outlet rent
- [ ] PPh25/29 corporate income-tax installment tracking
- [ ] e-Faktur / Coretax export format — verify against current Coretax CSV layout
- [ ] Bukti potong (withholding slip) PDF generation per vendor/employee, per period
- [ ] SPT Masa PPN / PPh21 report templates (recap for filing, not e-filing itself)
- [ ] NPWP/NIK 16-digit format validation on partner/employee master
- [ ] Tax-invoice numbering compliance (nomor seri faktur pajak format)
- [ ] Multi-tax-rate support per item (e.g. food vs. non-food merchandise)
- [ ] Tax-exemption flag per customer/item (e.g. government, diplomatic)
- [ ] THR (Tunjangan Hari Raya) calculation + scheduled payroll run before Lebaran
- [ ] BPJS Kesehatan + Ketenagakerjaan (JHT/JKK/JKM/JP) employer & employee contribution calc in payslip
- [ ] UMP/UMK regional minimum-wage reference table (Yogyakarta vs Jakarta) for payroll validation
- [ ] Cash rounding rules configurable (round to Rp 100/500/1000) at POS checkout

---

## 3. Sales / POS / Restaurant Operations

### 3.1 Floor Plan & Tables
- [ ] Visual floor-plan editor: multiple floors/areas, drag-drop table placement
- [ ] Table shapes (square/round), custom size, custom color
- [ ] Seat count per table
- [ ] Live table-status colors (free/occupied/reserved/needs-cleaning/bill-printed)
- [ ] Merge/link adjacent tables for large groups
- [ ] Table reservation calendar + waitlist with estimated wait time
- [ ] QR code per table linking to digital menu / self-order

### 3.2 Order Taking & Kitchen
- [ ] Course sequencing (starter/main/dessert) with "fire course" trigger to kitchen
- [ ] Kitchen Display System (KDS) screen option, in addition to Naixer printers
- [ ] Printer routing rules by category/station (drinks vs. food vs. dessert)
- [ ] Order line notes ("less ice", "no sugar", allergy/spice level)
- [ ] Modifier groups: required/optional, min/max selectable, price delta per option
- [ ] Combo/meal-deal builder: fixed price, "choose one of group" components
- [ ] "86" an item — mark temporarily unavailable, auto-hides from POS + self-order
- [ ] Kitchen prep list auto-generated from open orders / par levels

### 3.3 Pricing & Promotions
- [ ] Happy-hour / time-of-day / day-of-week price rules
- [ ] Price lists per channel (dine-in vs. online vs. catering)
- [ ] Manual discount with manager-PIN approval + reason code
- [ ] Price override with reason + approval
- [ ] Daily specials / limited-time offers with auto-expiry

### 3.4 Billing & Payment
- [ ] Split bill: by item, by equal share, by seat/guest count
- [ ] Merge multiple open orders into one bill
- [ ] Transfer order to a different table
- [ ] Void/cancel a line item with reason + approval; void whole order with reason
- [ ] Complimentary (comp) item flag — free but tracked for COGS/marketing reporting
- [ ] Tips: collect, pool across staff, report by shift/employee
- [ ] Service charge line item (distinct from PB1/PPN), on/off + % configurable
- [ ] Split payment across multiple methods (cash + QRIS + card) on one order
- [ ] Open/miscellaneous sale line (custom description + custom price)
- [ ] Refund/return from POS with reason + manager approval

### 3.5 Cash Drawer & Shift
- [ ] Cash drawer open/close, "no sale" (open drawer without a sale, for change)
- [ ] Cash-in / cash-out with reason during a shift
- [ ] End-of-shift cash count by denomination (Rp100k/50k/20k/10k/5k/2k/1k + coins) vs. system-expected, variance shown
- [ ] X-report (mid-shift, non-resetting summary) and Z-report (end-of-day, resets counters)
- [ ] Order hold/park + recall later

### 3.6 Self-Order / Kiosk / Online
- [ ] Self-order modes: disabled / QR-menu-only / QR-menu+ordering / kiosk
- [ ] Self-order service mode: pickup-counter vs. table-service, configurable per branch
- [ ] Self-order pay-before vs. pay-after-meal configurable
- [ ] Self-order kiosk multi-language (id/en/zh) with default + selectable languages
- [ ] Self-order kiosk branding (home image, brand logo)
- [ ] Order-source tagging: dine-in / takeaway / delivery / GoFood / GrabFood / ShopeeFood / website / phone
- [ ] Delivery-platform commission auto-calc (net = 80% of price) + reconciliation vs. platform payout statement
- [ ] Order-ready status board for pickup counters ("Order #42 ready")
- [ ] Customer-facing secondary display (running order + total + change due)

### 3.7 Receipts & Misc.
- [ ] Multi-language receipt (id/en/zh based on customer preference)
- [ ] Digital receipt via WhatsApp/email (paperless option)
- [ ] Receipt customization: footer message/promo text, social handle, feedback-survey QR
- [ ] Loyalty point balance printed on receipt
- [ ] Product images + color-coded categories on POS grid
- [ ] Quick-key/favorite shortcuts on POS layout, customizable per terminal/branch

### 3.8 Sales Analytics (operational, not financial — see also §9)
- [ ] Daily sales target per branch + live progress indicator
- [ ] Staff sales leaderboard / per-staff commission tracking
- [ ] Table-turnover-time report (avg seating duration)
- [ ] Peak-hour heatmap

---

## 4. CRM, Loyalty & Marketing

- [ ] Member database — done
- [ ] Loyalty point tiers (e.g. bronze/silver/gold) with auto-upgrade thresholds
- [ ] Loyalty point expiry rules (e.g. expire after 12 months of inactivity)
- [ ] Gift cards: sell, redeem, check balance, top-up/reload
- [ ] Discount/promo codes: single-use, multi-use, date-limited, per-customer-limited
- [ ] "Buy X get Y" automatic promotion rule type
- [ ] Referral program (both referrer & referee rewarded)
- [ ] Birthday club: auto voucher/notification near member birthday
- [ ] Customer segmentation by spend/frequency/recency (RFM-style)
- [ ] Marketing campaign log (WhatsApp/email/SMS blast) reusing notification infra
- [ ] Customer feedback / NPS survey link sent after purchase
- [ ] Complaint handling — done (helpdesk)
- [ ] Customer order history + "reorder my favorite" on member self-service
- [ ] Customer lifetime value shown on member profile
- [ ] Lead/opportunity pipeline for catering / corporate bulk orders
- [ ] Promotional calendar view (upcoming campaigns/discounts at a glance)

---

## 5. Inventory & Warehouse

- [ ] Multi-UOM + conversions — done (T-0295/T-0297)
- [ ] Multi-location stock, GRN, transfer, adjustment — done
- [ ] Stock opname / cycle-count: printable count sheet + variance report + approval workflow
- [ ] Batch/lot tracking with expiry dates
- [ ] FEFO (first-expire-first-out) suggestion when issuing stock
- [ ] Stock valuation: weighted average — done; FIFO as alternative method (config per item/category)
- [ ] Reorder point / par level per product per location + low-stock alert/notification
- [ ] Auto-generate purchase suggestion list from items below reorder point
- [ ] Stock-aging report (days since last movement; slow-moving/dead-stock list)
- [ ] Bin/shelf location within a warehouse (optional granularity)
- [ ] Barcode scanning input for GRN/transfer/adjustment/opname (keyboard-wedge friendly)
- [ ] Landed-cost allocation: spread freight/import duty across received lines by value/qty/weight
- [ ] Negative-stock policy configurable per location (block/warn/allow)
- [ ] Inventory valuation report (qty × avg cost, by category/location, point-in-time)
- [ ] Sales return → restock flow (customer return)
- [ ] Scrap/wastage reason-code master list, manageable via UI (currently string-match per T-0174)
- [ ] Packaging-unit definitions (case of 24, box of 12) distinct from base/recipe UOM
- [ ] Inter-branch transfer **request** (branch asks central kitchen) with approval, distinct from direct transfer

---

## 6. Manufacturing / Recipes (BOM)

- [ ] Multi-level BOM — sub-recipes (e.g. "simple syrup" used inside many drink recipes)
- [ ] Recipe yield (1 batch → N servings) with automatic per-serving cost derivation
- [ ] Wastage % per ingredient line (prep loss baked into costing)
- [ ] Recipe versioning — effective-dated changes + history of past versions
- [ ] Recipe instructions/steps + reference photo (training/SOP use)
- [ ] Allergen & nutrition info per recipe/menu item (gluten/dairy/nuts/halal flags)
- [ ] Recipe costing report with margin % + negative-margin flag — done partial (T-0174), verify multi-level BOM cost rollup
- [ ] Cost-variance report: standard recipe cost vs. actual ingredient consumption cost
- [ ] Production/batch order for prep items: consume raw ingredients → produce semi-finished stock (e.g. brew 5 L of tea base)
- [ ] By-products tracked separately (rare in F&B, low priority)
- [ ] Recipe-scaling calculator in UI (scale recipe to a target batch size)
- [ ] Consumption policy per recipe: strict / warning / flexible vs. defined quantities

---

## 7. Purchasing & Procurement

- [ ] Purchase order — done
- [ ] Purchase requisition (internal request before PO, with approval)
- [ ] RFQ to multiple vendors + side-by-side comparison view
- [ ] Vendor price list / price history per item (track price changes over time)
- [ ] Vendor item codes / catalog mapping (our SKU ↔ vendor SKU)
- [ ] 3-way match (PO–GRN–Invoice) before payment release
- [ ] Purchase invoice generated from PO/GRN
- [ ] Purchase return — done
- [ ] Blanket/standing orders (recurring weekly order to a fixed vendor)
- [ ] Minimum order qty / lead time per vendor-item
- [ ] Vendor performance scorecard (on-time delivery %, reject/return rate)
- [ ] Debit note to vendor (for shortages/quality issues without full return)
- [ ] Shipment tracking — done (BinderByte)

---

## 8. HR & Payroll

- [ ] Employee master, attendance, schedule, payroll — done
- [ ] Leave management: configurable leave types (annual/sick/unpaid/maternity/paternity), balance accrual rules, request/approval calendar view
- [ ] Overtime calculation rules (multiplier by weekday/weekend/holiday per Indonesian labor law)
- [ ] Payroll components configurable via UI (allowances/deductions), not hardcoded
- [ ] Loan/advance to employee with installment auto-deduction from payroll
- [ ] Employee self-service completeness check: payslip history, leave request/balance, attendance history, schedule — verify all present
- [ ] Performance appraisal / KPI review cycle (periodic, manager-rated)
- [ ] Recruitment pipeline (job posting → applicant → interview stage → hire → convert to employee)
- [ ] Onboarding/offboarding checklist per employee (equipment issued, accounts created/revoked)
- [ ] Training records / certification expiry reminders (food-handler cert, etc.)
- [ ] Employee document vault (contract, ID copy, certificates) with access control
- [ ] Org chart visualization
- [ ] Disciplinary record / warning-letter log (SP1/SP2/SP3) — repo already references "SURAT PERINGATAN.pdf" as a real document type
- [ ] Exit/resignation workflow + clearance checklist (assets returned, final pay)
- [ ] Birthday/work-anniversary reminders for managers
- [ ] Employee directory with photos, searchable by name/position/branch
- [ ] Shift swap — done

---

## 9. Reporting & Business Intelligence

- [ ] Financial statements (BS/P&L/TB/cash flow) — done
- [ ] Sales analysis by product/category/hour-of-day/day-of-week/branch/payment-method/order-source
- [ ] Menu-engineering matrix (popularity vs. profitability quadrant: stars/plowhorses/puzzles/dogs)
- [ ] Inventory reports — done partial (valuation, aging, waste)
- [ ] HR reports: attendance summary, payroll summary, headcount by branch
- [ ] Custom pivot/report builder for ad-hoc questions
- [ ] Scheduled report delivery via email
- [ ] Role-specific KPI dashboards (owner/manager/cashier each see relevant widgets)
- [ ] Drill-down everywhere: dashboard → summary report → detail → source document
- [ ] Period-over-period comparison — done
- [ ] Export to Excel/PDF/CSV — done partial, verify coverage across all reports

---

## 10. Multi-Branch / Multi-Company / Franchise-Readiness

- [ ] `location_id` dimension — done
- [ ] Per-branch settings: tax-rate overrides, receipt template, opening hours, printer config
- [ ] Central kitchen / commissary model: produce centrally, transfer to branches at internal transfer price
- [ ] Inter-branch P&L comparison report
- [ ] Franchise-readiness fields (royalty %, franchise fee schedule) — future flag only, not active logic

---

## 11. Online Channels & Integrations

- [ ] Naixer KDS via QR — done
- [ ] Public REST API + Scalar docs — done
- [ ] GoFood/GrabFood/ShopeeFood order import / sales reconciliation
- [ ] WhatsApp Business notifications (order ready, promo blast, reservation confirmation)
- [ ] QRIS payment status webhook / confirmation flow
- [ ] Public website / online ordering (CMS) — verify current status & scope
- [ ] Outbound email (SMTP) — done for internal notifications

---

## 12. Mobile, Offline & Hardware

- [ ] PWA offline POS — done (ADR-0009)
- [ ] Native app (Tauri) silent print — done (F7)
- [ ] Barcode scanner hardware support (USB/Bluetooth HID keyboard-wedge input)
- [ ] Customer-facing second-screen display support
- [ ] Cash-drawer kick via receipt printer
- [ ] Scale/weighing-machine integration for bulk ingredient receiving (future, low priority)

---

## 13. Security, Audit & Compliance

- [ ] Audit log (immutable, before/after diff) — done
- [ ] RBAC / permission engine — done
- [ ] Two-factor authentication (TOTP) for staff/admin — verify status
- [ ] PII encryption at rest (NIK/NPWP/phone) — done partial
- [ ] Session management (multi-device, revoke) — done
- [ ] Approval workflows — done partial (extend to more transaction types)
- [ ] Data subject access/delete tooling for UU PDP — done partial (member delete)

---

## 14. Documents & Communication

- [ ] SOP module — done
- [ ] Generic document-template library (contracts, NDAs, offer letters)
- [ ] Internal announcements / bulletin board (company-wide notices)
- [ ] Personal to-do list / task reminders per user

---

## 15. Project / Task Management

- [ ] Lightweight Kanban task board for non-recurring projects (renovation, marketing campaign, new menu launch)
- [ ] Gantt/timeline view for project schedules
- [ ] Task assignment + due date + checklist + comments

---

## 16. Asset / Equipment Maintenance

- [ ] Equipment register (espresso machine, blender, fridge, freezer) with maintenance schedule
- [ ] Maintenance request/ticket + service history log
- [ ] Warranty expiry tracking + reminders

---

## 17. Quality Management / Food Safety

- [ ] HACCP-style checklist: daily fridge/freezer temperature logs
- [ ] Cleaning schedule checklist (daily/weekly/monthly tasks per area)
- [ ] Halal-certification tracking per supplier/ingredient + expiry reminders
- [ ] Supplier food-safety certificate expiry tracking

---

## Summary Counts

| Section | Approx. items |
|---|---|
| 0. Cross-cutting UX shell | ~50 |
| 1. Accounting & Finance | ~30 |
| 2. Tax & Indonesian Compliance | ~17 |
| 3. Sales / POS / Restaurant | ~40 |
| 4. CRM, Loyalty & Marketing | ~15 |
| 5. Inventory & Warehouse | ~18 |
| 6. Manufacturing / Recipes | ~12 |
| 7. Purchasing & Procurement | ~13 |
| 8. HR & Payroll | ~17 |
| 9. Reporting & BI | ~11 |
| 10. Multi-Branch/Company | ~5 |
| 11. Online Channels | ~7 |
| 12. Mobile/Offline/Hardware | ~6 |
| 13. Security/Audit/Compliance | ~7 |
| 14. Documents & Communication | ~4 |
| 15. Project/Task Management | ~3 |
| 16. Asset/Equipment Maintenance | ~3 |
| 17. Quality Management | ~4 |
| **Total** | **~260+** |

**Next step**: cross-reference every item above against the actual repo
implementation (code + schema, not just planning docs) and produce
`docs/benchmark/fnb-erp-gap-analysis.md` with a Done / Partial / Missing verdict and
size estimate (S/M/L/XL) per item.
