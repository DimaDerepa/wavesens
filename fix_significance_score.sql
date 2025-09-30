-- Fix significance_score field overflow
-- Execute this in Railway database console

ALTER TABLE news_items
ALTER COLUMN significance_score TYPE DECIMAL(5,2);

-- Verify the change
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'news_items' AND column_name = 'significance_score';