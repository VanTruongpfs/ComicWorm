-- Dữ liệu mẫu để thử chức năng hiển thị sản phẩm. Chạy SAU schema.sql và seed.sql.
-- Tài khoản mẫu chỉ để làm chủ tin/người mua (password_hash là chuỗi giả, KHÔNG đăng nhập được).
USE bookmooch_db_v3;
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO users (id, email, password_hash, full_name, avatar_url, role, is_seller) VALUES
(101, 'seller.demo@comicworm.test', 'demo-not-a-real-hash', 'AnVinh Collector', NULL, 'USER', true),
(102, 'buyer.demo@comicworm.test',  'demo-not-a-real-hash', 'Minh Anh',         NULL, 'USER', false);

INSERT INTO products
 (id, seller_id, title, slug, description, category_id, author_id, publisher_id, volume_numbers, edition_type,
  publication_year, condition_percent, price, stock_quantity, listing_type, trade_wish_note, is_active,
  moderation_status, deleted_at) VALUES
(1001, 101, 'Slam Dunk Deluxe Edition - Trọn bộ 24 tập', 'slam-dunk-deluxe-tron-bo-24-tap',
 'Bộ Slam Dunk bản Deluxe của NXB Kim Đồng, giữ nguyên trang màu đầu chương.\nĐủ 24 tập, kèm postcard chưa bóc.',
 1, 1, 1, 'Tập 1-24', 'Deluxe', 2022, 99, 1850000, 3, 'SELL_AND_TRADE', 'Chainsaw Man (Tập 1-11) hoặc Tokyo Ghoul trọn bộ', true, 'APPROVED', NULL),
(1002, 101, 'One Piece - Boxset Wano Quốc (Tập 91-105)', 'one-piece-boxset-wano',
 'Boxset nguyên seal, chưa bóc.', 1, 2, 1, 'Tập 91-105', 'Boxset', 2021, 100, 850000, 5, 'SELL', NULL, true, 'APPROVED', NULL),
(1003, 101, 'Doraemon Truyện Dài - Tuyển tập 24 cuộc phiêu lưu', 'doraemon-truyen-dai-tuyen-tap',
 'Tuyển tập truyện dài, bản màu.', 3, 3, 2, 'Tập 1-24', NULL, 2019, 95, 290000, 2, 'TRADE', 'Ưu tiên đổi lấy Conan bản màu', true, 'APPROVED', NULL),
(1004, 101, 'Vagabond Perfect Edition (Tập 1-5)', 'vagabond-perfect-edition-1-5',
 'Đã đọc nhẹ, gáy sách còn phẳng.', 1, 1, 3, 'Tập 1-5', 'Perfect Edition', 2018, 90, 95000, 1, 'SELL', NULL, true, 'APPROVED', NULL),
(1005, 101, 'Truyện cổ hiếm in năm 1985', 'truyen-co-hiem-1985',
 'Sách sưu tầm, ngả vàng theo thời gian.', 4, NULL, NULL, NULL, NULL, 1985, 70, 450000, 1, 'SELL', NULL, true, 'APPROVED', NULL),
(1006, 101, '[CHỜ DUYỆT] Tin chưa được admin phê duyệt', 'tin-cho-duyet',
 'Tin này KHÔNG được xuất hiện ở danh sách công khai.', 1, NULL, NULL, NULL, NULL, 2020, 95, 120000, 1, 'SELL', NULL, true, 'PENDING', NULL),
(1007, 101, '[ĐÃ XÓA] Tin xóa mềm', 'tin-da-xoa',
 'Tin này KHÔNG được xuất hiện ở bất kỳ đâu.', 1, NULL, NULL, NULL, NULL, 2020, 95, 120000, 1, 'SELL', NULL, true, 'APPROVED', '2026-01-01 00:00:00'),
(1008, 101, 'Naruto Tập 1 (đã hết hàng)', 'naruto-tap-1-het-hang',
 'Hết hàng - dùng để thử trạng thái không mua được.', 1, NULL, 1, 'Tập 1', NULL, 2015, 96, 35000, 0, 'SELL', NULL, true, 'APPROVED', NULL);

INSERT INTO product_images (product_id, image_url, display_order) VALUES
(1001, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1000&q=80', 0),
(1001, 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1000&q=80', 1),
(1001, 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1000&q=80', 2),
(1002, 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1000&q=80', 0),
(1003, 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=1000&q=80', 0),
(1004, 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=1000&q=80', 0),
(1005, 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=1000&q=80', 0);
-- 1008 cố ý không có ảnh để thử ảnh thay thế.

-- Đơn hàng để thử "bán chạy" và "đánh giá". Kỳ vọng: 1001 bán 3, 1002 bán 1 (đơn CANCELLED không được tính).
INSERT INTO checkout_batches (id, checkout_code, buyer_id, idempotency_key, total_amount, expires_at) VALUES
(1, 'CHK-DEMO-1', 102, 'demo-idem-1', 10710000, '2030-01-01 00:00:00');

INSERT INTO orders (id, order_code, checkout_id, buyer_id, seller_id, subtotal_amount, shipping_fee, total_amount,
                    recipient_name, recipient_phone, shipping_address, status, payment_status, completed_at) VALUES
(1, 'ORD-DEMO-1', 1, 102, 101, 4550000, 30000, 4580000, 'Minh Anh', '0900000000', '1 Demo Street', 'COMPLETED', 'PAID', '2026-09-20 10:00:00'),
(2, 'ORD-DEMO-2', 1, 102, 101, 1850000, 30000, 1880000, 'Minh Anh', '0900000000', '1 Demo Street', 'COMPLETED', 'PAID', '2026-09-25 10:00:00'),
(3, 'ORD-DEMO-3', 1, 102, 101, 4250000, 0,     4250000, 'Minh Anh', '0900000000', '1 Demo Street', 'CANCELLED', 'PENDING', NULL);

INSERT INTO order_items (id, order_id, product_id, product_title, image_url, condition_percent, unit_price, quantity) VALUES
(1, 1, 1001, 'Slam Dunk Deluxe Edition - Trọn bộ 24 tập', NULL, 99, 1850000, 2),
(2, 1, 1002, 'One Piece - Boxset Wano Quốc (Tập 91-105)', NULL, 100, 850000, 1),
(3, 2, 1001, 'Slam Dunk Deluxe Edition - Trọn bộ 24 tập', NULL, 99, 1850000, 1),
(4, 3, 1002, 'One Piece - Boxset Wano Quốc (Tập 91-105)', NULL, 100, 850000, 5);

INSERT INTO reviews (id, order_item_id, buyer_id, rating, content) VALUES
(1, 1, 102, 5, 'Sách đúng mô tả, đóng gói 3 lớp rất kỹ. Người bán nhiệt tình!'),
(2, 3, 102, 4, 'Bộ truyện đẹp, giao hơi chậm một chút.');

INSERT INTO review_replies (review_id, seller_id, content) VALUES
(1, 101, 'Cảm ơn bạn đã ủng hộ shop!');

COMMIT;

-- Dọn dữ liệu mẫu (chạy khi không cần nữa):
-- DELETE FROM review_replies WHERE review_id IN (1,2);
-- DELETE FROM reviews WHERE id IN (1,2);
-- DELETE FROM order_items WHERE id IN (1,2,3,4);
-- DELETE FROM orders WHERE id IN (1,2,3);
-- DELETE FROM checkout_batches WHERE id = 1;
-- DELETE FROM product_images WHERE product_id BETWEEN 1001 AND 1008;
-- DELETE FROM products WHERE id BETWEEN 1001 AND 1008;
-- DELETE FROM users WHERE id IN (101,102);
