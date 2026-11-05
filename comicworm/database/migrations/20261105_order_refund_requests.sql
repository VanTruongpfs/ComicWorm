-- T04: người mua yêu cầu hoàn tiền trong 7 ngày sau khi giao; người bán đồng ý hoặc từ chối (kèm lý do).
-- Nếu app đã chạy với ddl-auto=update, Hibernate đã thêm 5 cột này (không có CHECK). Khi đó chỉ chạy hai lệnh
-- ADD CONSTRAINT ở cuối file.

ALTER TABLE `orders`
  ADD COLUMN `refund_request_status` VARCHAR(20) NULL AFTER `completed_at`,
  ADD COLUMN `refund_request_reason` TEXT NULL AFTER `refund_request_status`,
  ADD COLUMN `refund_reject_reason` TEXT NULL AFTER `refund_request_reason`,
  ADD COLUMN `refund_requested_at` DATETIME NULL AFTER `refund_reject_reason`,
  ADD COLUMN `refund_decided_at` DATETIME NULL AFTER `refund_requested_at`;

ALTER TABLE `orders`
  ADD CONSTRAINT `ck_orders_refund_request_status`
    CHECK (refund_request_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  ADD CONSTRAINT `ck_order_refund_reject_reason`
    CHECK (refund_request_status IS NULL OR refund_request_status <> 'REJECTED' OR refund_reject_reason IS NOT NULL);
