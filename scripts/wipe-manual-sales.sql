DELETE FROM stock_movements WHERE reference_type = 'manual_sales_closing';
DELETE FROM journal_entries WHERE reference_type = 'manual_sales_closing';
DELETE FROM manual_sales_closings;
