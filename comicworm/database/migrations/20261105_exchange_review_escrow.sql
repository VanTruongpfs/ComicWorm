-- Admin review of exchange deals and escrow of the cash compensation, paid out to an in-app wallet.
-- Run BEFORE starting the app. If the app already ran with ddl-auto=update, Hibernate added the exchange_offers
-- columns and created the three tables without CHECK constraints or named foreign keys. While the new tables are
-- still empty: run `DROP TABLE wallet_transactions, wallets, exchange_escrows;`, skip step 1 (the columns exist),
-- and run steps 2 to 4.

-- 1. Review state of a deal (the selected offer).
ALTER TABLE `exchange_offers`
  ADD COLUMN `admin_review_status` VARCHAR(20) NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN `reviewed_by` BIGINT NULL,
  ADD COLUMN `reviewed_at` DATETIME NULL,
  ADD COLUMN `review_note` VARCHAR(500) NULL;

-- 2. Deals that already have delivery orders predate the review step: keep them going.
UPDATE `exchange_offers` o
SET o.`admin_review_status` = 'APPROVED',
    o.`reviewed_at` = NOW(),
    o.`review_note` = 'Giao dịch tạo trước khi có bước duyệt'
WHERE o.`admin_review_status` = 'NOT_SUBMITTED'
  AND EXISTS (SELECT 1 FROM `exchange_order_links` l WHERE l.`offer_id` = o.`id`);

ALTER TABLE `exchange_offers`
  ADD KEY `idx_offer_admin_review` (`admin_review_status`),
  ADD CONSTRAINT `ck_exchange_offers_admin_review_status`
    CHECK (admin_review_status IN ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED')),
  ADD CONSTRAINT `ck_offer_reject_note` CHECK (admin_review_status <> 'REJECTED' OR review_note IS NOT NULL),
  ADD CONSTRAINT `fk_exchange_offers_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`);

-- 3. Escrow of the cash compensation.
CREATE TABLE IF NOT EXISTS `exchange_escrows` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `room_id` BIGINT NOT NULL,
  `offer_id` BIGINT NOT NULL UNIQUE,
  `payer_id` BIGINT NOT NULL,
  `payee_id` BIGINT NOT NULL,
  `source_order_id` BIGINT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'HELD',
  `held_at` DATETIME NOT NULL,
  `ready_at` DATETIME NULL,
  `resolved_at` DATETIME NULL,
  `resolved_by` BIGINT NULL,
  `resolution_note` VARCHAR(500) NULL,
  KEY `idx_escrow_status` (`status`, `id`),
  CONSTRAINT `ck_escrow_parties` CHECK (payer_id <> payee_id),
  CONSTRAINT `ck_escrow_resolution` CHECK (status NOT IN ('RELEASED', 'REFUNDED') OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL AND resolution_note IS NOT NULL)),
  CONSTRAINT `ck_exchange_escrows_amount` CHECK (amount > 0),
  CONSTRAINT `ck_exchange_escrows_status` CHECK (status IN ('HELD', 'READY', 'RELEASED', 'REFUNDED')),
  CONSTRAINT `fk_exchange_escrows_room_id` FOREIGN KEY (`room_id`) REFERENCES `exchange_rooms` (`id`),
  CONSTRAINT `fk_exchange_escrows_offer_id` FOREIGN KEY (`offer_id`) REFERENCES `exchange_offers` (`id`),
  CONSTRAINT `fk_exchange_escrows_payer_id` FOREIGN KEY (`payer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_exchange_escrows_payee_id` FOREIGN KEY (`payee_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_exchange_escrows_source_order_id` FOREIGN KEY (`source_order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_exchange_escrows_resolved_by` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. In-app wallet (credits only; no withdrawal yet).
CREATE TABLE IF NOT EXISTS `wallets` (
  `user_id` BIGINT NOT NULL PRIMARY KEY,
  `balance` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `ck_wallets_balance` CHECK (balance >= 0),
  CONSTRAINT `fk_wallets_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `escrow_id` BIGINT NOT NULL UNIQUE,
  `balance_after` DECIMAL(15,2) NOT NULL,
  `note` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_wallet_history` (`user_id`, `id`),
  CONSTRAINT `ck_wallet_transactions_amount` CHECK (amount > 0),
  CONSTRAINT `ck_wallet_transactions_type` CHECK (type IN ('ESCROW_RELEASE', 'ESCROW_REFUND')),
  CONSTRAINT `ck_wallet_transactions_balance_after` CHECK (balance_after >= 0),
  CONSTRAINT `fk_wallet_transactions_user_id` FOREIGN KEY (`user_id`) REFERENCES `wallets` (`user_id`),
  CONSTRAINT `fk_wallet_transactions_escrow_id` FOREIGN KEY (`escrow_id`) REFERENCES `exchange_escrows` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
