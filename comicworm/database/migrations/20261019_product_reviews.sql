-- Migration for Product Reviews Multi-criteria (Quality, Attitude)
ALTER TABLE `reviews`
  ADD COLUMN `product_quality_rating` INT NULL AFTER `rating`,
  ADD COLUMN `seller_attitude_rating` INT NULL AFTER `product_quality_rating`;

UPDATE `reviews`
SET `product_quality_rating` = `rating`,
    `seller_attitude_rating` = `rating`
WHERE `product_quality_rating` IS NULL;

