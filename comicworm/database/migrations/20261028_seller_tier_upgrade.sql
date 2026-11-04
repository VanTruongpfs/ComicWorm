-- Migration: Seller Tier & Upgrade Request System (From User -> Seller Level 1..5)

CREATE TABLE IF NOT EXISTS `seller_profiles` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL UNIQUE,
  `shop_name` VARCHAR(150) NOT NULL,
  `shop_description` TEXT NULL,
  `level` INT NOT NULL DEFAULT 1,
  `total_completed_orders` INT NOT NULL DEFAULT 0,
  `total_revenue` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_seller_profiles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `seller_upgrade_requests` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `from_level` INT NOT NULL DEFAULT 0,
  `to_level` INT NOT NULL,
  `shop_name` VARCHAR(150) NULL,
  `shop_description` TEXT NULL,
  `fee_amount` DECIMAL(15,2) NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'MANUAL_TRANSFER',
  `payment_proof_url` TEXT NULL,
  `transaction_code` VARCHAR(100) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  `admin_id` BIGINT NULL,
  `rejection_reason` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME NULL,
  INDEX `idx_upgrade_user` (`user_id`, `status`),
  INDEX `idx_upgrade_status` (`status`, `created_at`),
  CONSTRAINT `fk_upgrade_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_upgrade_admin_id` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill profiles for existing sellers
INSERT IGNORE INTO `seller_profiles` (`user_id`, `shop_name`, `level`)
SELECT `id`, `full_name`, 1 FROM `users` WHERE `is_seller` = true;

