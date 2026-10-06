-- Read-only screen queries for Nhom8_ChucNang.docx.
USE bookmooch_db_v3;
SET @user_id=0;
SET @seller_id=0;
SET @from_date='2026-01-01';
SET @to_date='2027-01-01';
SET @category_id=NULL;
SET @publisher_id=NULL;
SET @min_price=0;
SET @max_price=999999999;

-- Detail/list/filter. Brand in the comic catalog maps to publisher.
SELECT p.id,p.title,p.price,p.condition_percent,p.stock_quantity,
       c.name AS category,a.name AS author,pub.name AS publisher,im.image_url
FROM products p
JOIN categories c ON c.id=p.category_id
JOIN users u ON u.id=p.seller_id
LEFT JOIN authors a ON a.id=p.author_id
LEFT JOIN publishers pub ON pub.id=p.publisher_id
LEFT JOIN product_images im ON im.product_id=p.id AND im.display_order=0
WHERE p.moderation_status='APPROVED' AND p.is_active=TRUE
  AND p.deleted_at IS NULL AND u.deleted_at IS NULL AND u.account_status='ACTIVE'
  AND (@category_id IS NULL OR p.category_id=@category_id)
  AND (@publisher_id IS NULL OR p.publisher_id=@publisher_id)
  AND p.price BETWEEN @min_price AND @max_price
ORDER BY p.created_at DESC,p.id DESC LIMIT 24;

-- Newest products on home page.
SELECT id,title,slug,price,created_at FROM products
WHERE moderation_status='APPROVED' AND is_active=TRUE AND deleted_at IS NULL
ORDER BY created_at DESC,id DESC LIMIT 12;

-- Bestseller ranking: fulfilled purchases, no persisted sales counter.
SELECT p.id,p.title,SUM(oi.quantity) AS units_sold
FROM products p JOIN order_items oi ON oi.product_id=p.id
JOIN orders o ON o.id=oi.order_id
WHERE o.status='COMPLETED' AND p.moderation_status='APPROVED'
  AND p.is_active=TRUE AND p.deleted_at IS NULL
GROUP BY p.id,p.title ORDER BY units_sold DESC,p.id LIMIT 12;

-- Buyer purchase history, immutable order item snapshots.
SELECT o.order_code,o.status,o.payment_status,o.created_at,
       oi.product_title,oi.unit_price,oi.quantity,o.total_amount
FROM orders o JOIN order_items oi ON oi.order_id=o.id
WHERE o.buyer_id=@user_id ORDER BY o.created_at DESC,o.id DESC,oi.id;

-- Seller revenue bar chart within selected interval.
-- Merchandise value only: shipping fee is excluded.
SELECT DATE(o.completed_at) AS day,SUM(o.subtotal_amount) AS merchandise_revenue
FROM orders o WHERE o.seller_id=@seller_id AND o.status='COMPLETED'
  AND o.completed_at>=@from_date AND o.completed_at<@to_date
GROUP BY DATE(o.completed_at) ORDER BY day;

-- Admin revenue bar chart for the selected interval.
SELECT DATE(o.completed_at) AS day,SUM(o.subtotal_amount) AS merchandise_revenue
FROM orders o WHERE o.status='COMPLETED'
  AND o.completed_at>=@from_date AND o.completed_at<@to_date
GROUP BY DATE(o.completed_at) ORDER BY day;

-- Separate pie datasets: user roles, product categories, order states.
SELECT role AS label,COUNT(*) AS total FROM users
WHERE deleted_at IS NULL GROUP BY role;
SELECT c.name AS label,COUNT(p.id) AS total FROM categories c
LEFT JOIN products p ON p.category_id=c.id AND p.deleted_at IS NULL
GROUP BY c.id,c.name;
SELECT status AS label,COUNT(*) AS total FROM orders
WHERE created_at>=@from_date AND created_at<@to_date GROUP BY status;

-- Product review and seller reply.
SELECT r.id,r.rating,r.content,u.full_name,rr.content AS seller_reply
FROM reviews r JOIN users u ON u.id=r.buyer_id
JOIN order_items oi ON oi.id=r.order_item_id
LEFT JOIN review_replies rr ON rr.review_id=r.id
WHERE oi.product_id=0 ORDER BY r.created_at DESC;

-- Moderation assistance from AI, human decision remains in products.
SELECT p.id,p.title,p.moderation_status,pc.status AS classification_status,
       pc.is_comic,pc.confidence,pc.model_name
FROM products p LEFT JOIN product_classifications pc ON pc.product_id=p.id
WHERE p.moderation_status='PENDING' AND p.deleted_at IS NULL;

-- Image search candidates: compare vectors in backend using the same model.
SELECT pi.product_id,pif.embedding,pif.model_name
FROM product_image_features pif JOIN product_images pi ON pi.id=pif.image_id
JOIN products p ON p.id=pi.product_id
WHERE p.moderation_status='APPROVED' AND p.is_active=TRUE AND p.deleted_at IS NULL;
