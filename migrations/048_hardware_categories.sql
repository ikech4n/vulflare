-- Migrate existing hardware category to hw_other
UPDATE eol_products SET category = 'hw_other' WHERE category = 'hardware';
