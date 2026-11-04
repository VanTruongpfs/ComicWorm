-- Seller applications: buyers submit (sample) CCCD details; an admin approves (users.is_seller = true) or rejects with a reason.
-- Run BEFORE starting the app. If the app already ran with ddl-auto=update, Hibernate created this table without the
-- CHECK constraints and named foreign keys. While it is still empty, run `DROP TABLE seller_applications;` and then this file.

CREATE TABLE IF NOT EXISTS `seller_applications` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `id_number` CHAR(12) NOT NULL,
  `id_full_name` VARCHAR(100) NOT NULL,
  `id_date_of_birth` DATE NOT NULL,
  `id_issue_date` DATE NOT NULL,
  `id_issue_place` VARCHAR(200) NOT NULL,
  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` BIGINT NULL,
  `reviewed_at` DATETIME NULL,
  `review_note` VARCHAR(500) NULL,
  KEY `idx_seller_application_status` (`status`, `submitted_at`),
  KEY `idx_seller_application_user` (`user_id`, `submitted_at`),
  CONSTRAINT `ck_seller_application_reject_note` CHECK (status <> 'REJECTED' OR review_note IS NOT NULL),
  CONSTRAINT `ck_seller_applications_status` CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT `fk_seller_applications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_seller_applications_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
