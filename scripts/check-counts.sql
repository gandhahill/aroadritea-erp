SELECT count(*) FROM manual_sales_closings;
SELECT count(*) FROM journal_entries WHERE reference_type = 'manual_sales_closing';
SELECT count(*) FROM stock_movements WHERE reference_type = 'manual_sales_closing';
