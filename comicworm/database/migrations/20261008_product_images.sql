-- Run against the selected ComicWorm database. Safe to run again.
-- Existing images are preserved; the first existing image becomes the cover.
SET @add_cover = (SELECT COUNT(*) = 0 FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'cover_image_url');
SET @ddl = IF(@add_cover, 'ALTER TABLE products ADD COLUMN cover_image_url TEXT NULL AFTER description', 'SELECT 1');
PREPARE migration_statement FROM @ddl;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @add_image_type = (SELECT COUNT(*) = 0 FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'product_images' AND column_name = 'image_type');
SET @ddl = IF(@add_image_type,
  'ALTER TABLE product_images ADD COLUMN image_type VARCHAR(10) NOT NULL DEFAULT ''DETAIL'' AFTER image_url', 'SELECT 1');
PREPARE migration_statement FROM @ddl;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

UPDATE product_images image
JOIN (SELECT product_id, MIN(display_order) AS first_position FROM product_images GROUP BY product_id) first_image
  ON first_image.product_id = image.product_id AND first_image.first_position = image.display_order
SET image.image_type = 'COVER'
WHERE @add_image_type;

UPDATE products product SET cover_image_url = (
  SELECT image.image_url FROM product_images image
  WHERE image.product_id = product.id AND image.image_type = 'COVER'
  ORDER BY image.display_order, image.id LIMIT 1
) WHERE product.cover_image_url IS NULL;

SET @ddl = IF((SELECT COUNT(*) = 0 FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE() AND table_name = 'product_images' AND constraint_name = 'ck_product_images_image_type'),
  'ALTER TABLE product_images ADD CONSTRAINT ck_product_images_image_type CHECK (image_type IN (''COVER'', ''DETAIL''))', 'SELECT 1');
PREPARE migration_statement FROM @ddl;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
