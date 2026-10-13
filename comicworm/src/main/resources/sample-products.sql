-- Optional local demo data. Enable only for a server run with:
-- .\gradlew.bat bootRun --args="--spring.sql.init.mode=always --spring.sql.init.data-locations=optional:classpath:sample-products.sql --spring.jpa.defer-datasource-initialization=true"
-- Omit these arguments or delete this file to disable the sample seed.
-- The demo seller has no usable login password.

-- cd .\comicworm
-- .\gradlew.bat bootRun --args="--spring.sql.init.mode=always --spring.sql.init.data-locations=optional:classpath:sample-products.sql --spring.jpa.defer-datasource-initialization=true"

INSERT INTO users (email, password_hash, full_name, role, is_seller, account_status, created_at, updated_at)
VALUES ('seller.sample@comicworm.test', 'sample-account-cannot-login', 'ComicWorm Demo Shop', 'USER', TRUE,
    'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @sample_seller_id = LAST_INSERT_ID();

INSERT INTO categories (name, slug)
VALUES ('Truyện mẫu', 'sample-comics')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @sample_category_id = LAST_INSERT_ID();

INSERT IGNORE INTO products
    (seller_id, title, slug, description, cover_image_url, category_id, volume_numbers,
     edition_type, publication_year, condition_percent, price, stock_quantity,
    listing_type, is_active, moderation_status, created_at, updated_at)
VALUES
    (@sample_seller_id, 'Doraemon - Tập 1', 'sample-doraemon-volume-1',
     'Truyện mẫu để kiểm tra danh sách và trang chi tiết sản phẩm.',
     'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1000&q=80',
    @sample_category_id, 'Tập 1', 'Bìa mềm', 2024, 98, 35000, 8, 'SELL', TRUE, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (@sample_seller_id, 'Thám tử lừng danh Conan - Tập 1', 'sample-conan-volume-1',
     'Sản phẩm mẫu còn hàng, có thể dùng để thử thao tác mua.',
     'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1000&q=80',
    @sample_category_id, 'Tập 1', 'Bìa mềm', 2023, 95, 28000, 4, 'SELL', TRUE, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (@sample_seller_id, 'One Piece - Trọn bộ tập 1-5', 'sample-one-piece-volumes-1-5',
     'Bộ truyện mẫu dùng để kiểm tra hiển thị nhiều sản phẩm.',
     'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1000&q=80',
    @sample_category_id, 'Tập 1-5', 'Bìa mềm', 2022, 92, 150000, 2, 'SELL', TRUE, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Optional cleanup after stopping the server. Remove only these sample records.
-- DELETE FROM products WHERE slug IN ('sample-doraemon-volume-1', 'sample-conan-volume-1', 'sample-one-piece-volumes-1-5');
-- DELETE FROM categories WHERE slug = 'sample-comics' AND NOT EXISTS (SELECT 1 FROM products WHERE category_id = categories.id);
-- DELETE FROM users WHERE email = 'seller.sample@comicworm.test' AND NOT EXISTS (SELECT 1 FROM products WHERE seller_id = users.id);