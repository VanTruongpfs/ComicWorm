-- T08: dùng điểm thưởng để giảm giá khi thanh toán (1 điểm = app.loyalty.redeem-vnd-per-point đồng).
-- Điểm được chia theo tỷ lệ tiền hàng của từng đơn trong đợt checkout và chỉ trừ vào tiền hàng,
-- nên total_amount = subtotal_amount + shipping_fee - points_discount.
-- Nếu app đã chạy với ddl-auto=update, Hibernate đã thêm cột points_discount (không có CHECK).
-- Khi đó bỏ lệnh ADD COLUMN đầu tiên và chạy các lệnh còn lại.

ALTER TABLE `orders`
  ADD COLUMN `points_discount` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `shipping_fee`;

ALTER TABLE `orders`
  DROP CHECK `ck_order_total`;

ALTER TABLE `orders`
  ADD CONSTRAINT `ck_order_total` CHECK (total_amount = subtotal_amount + shipping_fee - points_discount),
  ADD CONSTRAINT `ck_order_points_discount` CHECK (points_discount <= subtotal_amount),
  ADD CONSTRAINT `ck_orders_points_discount` CHECK (points_discount >= 0);

ALTER TABLE `loyalty_transactions`
  DROP CHECK `ck_loyalty_sign`,
  DROP CHECK `ck_loyalty_transactions_transaction_type`;

ALTER TABLE `loyalty_transactions`
  ADD CONSTRAINT `ck_loyalty_sign` CHECK ((transaction_type IN ('EARN', 'REDEEM_RETURN') AND points_delta > 0) OR (transaction_type IN ('REVERSAL', 'REDEEM') AND points_delta < 0)),
  ADD CONSTRAINT `ck_loyalty_transactions_transaction_type` CHECK (transaction_type IN ('EARN', 'REVERSAL', 'REDEEM', 'REDEEM_RETURN'));
