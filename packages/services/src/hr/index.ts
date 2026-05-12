/**
 * HR & Payroll services — SD §9.6, §21.8
 *
 * Exports: hr.listEmployees, hr.getEmployee, hr.createEmployee
 * Permission: hr.employee.read, hr.employee.write (per SD §11)
 */

export * from './schemas.js';
export * from './list-employees.js';
export * from './get-employee.js';
export * from './create-employee.js';
export * from './attendance-service.js';
export * from './disciplinary-service.js';