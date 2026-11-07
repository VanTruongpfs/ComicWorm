-- Phân loại tự động sản phẩm chờ duyệt thành Hợp lệ / Không hợp lệ.
-- ProductClassificationJob ghi kết quả vào các cột này; admin chỉ duyệt được sản phẩm ai_verdict = 'VALID'.
-- ai_verdict NULL nghĩa là chưa phân loại (job sẽ xử lý trong lần chạy kế tiếp).
-- Nếu app đã chạy với ddl-auto=update, Hibernate đã thêm 4 cột (không có CHECK).
-- Khi đó bỏ lệnh ADD COLUMN và chỉ chạy lệnh ADD CONSTRAINT.

ALTER TABLE `products`
  ADD COLUMN `ai_verdict` VARCHAR(20) NULL AFTER `moderated_at`,
  ADD COLUMN `ai_reasons` TEXT NULL AFTER `ai_verdict`,
  ADD COLUMN `ai_score` DECIMAL(5,4) NULL AFTER `ai_reasons`,
  ADD COLUMN `ai_classified_at` DATETIME NULL AFTER `ai_score`;

ALTER TABLE `products`
  ADD CONSTRAINT `ck_products_ai_verdict` CHECK (ai_verdict IN ('VALID', 'INVALID')),
  ADD CONSTRAINT `ck_products_ai_score` CHECK (ai_score BETWEEN 0 AND 1);
