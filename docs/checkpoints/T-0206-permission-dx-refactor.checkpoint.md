# 🟢 TASK: T-0206-permission-dx-refactor

## Context
User reported a poor developer experience configuring permissions on pages and sidebars, noting that some users had partial access (e.g., reimbursement) but could see all accounting modules leading to `403 Forbidden` errors.

## Execution
- **Type-safe Engine**: Refactored `PermissionCode` from `PERMISSIONS_SEED` to create a strict union type in `packages/shared/src/types/permissions.ts`.
- **Strict Method Typing**: Updated `can`, `canGlobally`, `getAuthorizedLocations`, and `requirePermission` to accept `PermissionCode` instead of generic `string`.
- **Sidebar Integration**: Removed `permissionModule?: string` from `sidebar.tsx` and replaced it with `permission?: PermissionCode`. Mapped all legacy strings to exact database-backed permission codes (e.g. `accounting.coa` -> `accounting.coa.manage`).
- **Sidebar Engine**: Re-wrote `hasModuleAccess()` inside `sidebar.tsx` to explicitly check the strict `permission` against the `permissions` context passed from the layout layout using exact and wildcard checks.
- **Backend Safety**: Validated all `@erp/services` methods to ensure there were no arbitrary, non-existent permissions being required.
- **Fixes**: Reverted `logistics.shipments` missing permissions by adding them securely to `PermissionCode`.

## Next step
- Address UI Polish for `Tabs` component.
- Review/test Payroll Deduction Input.
