"""Only persistence required by the 25 functions in Nhom8_ChucNang.docx."""
from schema_tools import table, index, check, fk, note

table('users', '''
id bigint [pk, not null, increment]
email varchar(150) [not null, unique]
password_hash varchar(255)
google_sub varchar(255) [unique]
full_name varchar(100) [not null]
phone varchar(20)
avatar_url text
role varchar(20) [not null, default: 'USER', check: `role IN ('USER', 'ADMIN')`]
is_seller boolean [not null, default: false]
account_status varchar(20) [not null, default: 'ACTIVE', check: `account_status IN ('ACTIVE', 'LOCKED')`]
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
updated_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
deleted_at datetime
''', 'tg_auth')
check('users', 'ck_user_login_identity', 'password_hash IS NOT NULL OR google_sub IS NOT NULL')
table('auth_sessions', '''
id bigint [pk, not null, increment]
user_id bigint [not null]
token_hash char(64) [not null, unique]
expires_at datetime [not null]
revoked_at datetime
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_auth')
fk('auth_sessions', 'user_id', 'users')
index('auth_sessions', 'user_id,expires_at', key='idx_session_user_expiry')
table('password_reset_tokens', '''
id bigint [pk, not null, increment]
user_id bigint [not null]
token_hash char(64) [not null, unique]
expires_at datetime [not null]
used_at datetime
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_auth')
fk('password_reset_tokens', 'user_id', 'users')

table('categories', '''
id int [pk, not null, increment]
name varchar(100) [not null]
slug varchar(120) [not null, unique]
parent_id int
''', 'tg_catalog')
fk('categories', 'parent_id', 'categories')
table('authors', '''
id int [pk, not null, increment]
name varchar(150) [not null]
''', 'tg_catalog')
table('publishers', '''
id int [pk, not null, increment]
name varchar(150) [not null]
slug varchar(160) [not null, unique]
''', 'tg_catalog')
table('products', '''
id bigint [pk, not null, increment]
seller_id bigint [not null]
title varchar(255) [not null]
slug varchar(255) [not null, unique]
description text [not null]
cover_image_url text
category_id int [not null]
author_id int
publisher_id int
volume_numbers varchar(100)
edition_type varchar(50)
publication_year int
condition_percent int [not null, check: `condition_percent BETWEEN 0 AND 100`]
price decimal(15,2) [not null, check: `price >= 0`]
stock_quantity int [not null, default: 1, check: `stock_quantity >= 0`]
listing_type varchar(20) [not null, default: 'SELL', check: `listing_type IN ('SELL', 'TRADE', 'SELL_AND_TRADE')`]
trade_wish_note text
is_active boolean [not null, default: true]
moderation_status varchar(20) [not null, default: 'PENDING', check: `moderation_status IN ('PENDING', 'APPROVED', 'REJECTED')`]
moderated_by bigint
moderation_reason text
moderated_at datetime
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
updated_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
deleted_at datetime
''', 'tg_catalog')
for column, parent in [('seller_id','users'), ('category_id','categories'), ('author_id','authors'), ('publisher_id','publishers'), ('moderated_by','users')]:
    fk('products', column, parent)
index('products', 'id,seller_id', unique=True, key='uq_product_owner')
index('products', 'moderation_status,is_active,created_at', key='idx_product_latest')
index('products', 'category_id,price', key='idx_product_filter')
index('products', 'seller_id,created_at', key='idx_seller_products')
table('product_images', '''
id bigint [pk, not null, increment]
product_id bigint [not null]
image_url text [not null]
image_type varchar(10) [not null, default: 'DETAIL', check: `image_type IN ('COVER', 'DETAIL')`]
display_order int [not null, default: 0, check: `display_order >= 0`]
''', 'tg_catalog')
fk('product_images', 'product_id', 'products')
index('product_images', 'product_id,display_order', unique=True, key='uq_product_image_order')
note('product_images', 'image_type=COVER là ảnh bìa, DETAIL là ảnh chi tiết. URL ảnh bìa đồng bộ với products.cover_image_url. Một ảnh/một vị trí trong sản phẩm.')

table('carts', '''
id bigint [pk, not null, increment]
user_id bigint [not null, unique]
updated_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_orders_payments')
fk('carts', 'user_id', 'users')
table('cart_items', '''
id bigint [pk, not null, increment]
cart_id bigint [not null]
product_id bigint [not null]
quantity int [not null, default: 1, check: `quantity > 0`]
is_selected boolean [not null, default: true]
''', 'tg_orders_payments')
fk('cart_items', 'cart_id', 'carts')
fk('cart_items', 'product_id', 'products')
index('cart_items', 'cart_id,product_id', unique=True, key='uq_cart_product')
table('checkout_batches', '''
id bigint [pk, not null, increment]
checkout_code varchar(60) [not null, unique]
buyer_id bigint [not null]
idempotency_key varchar(100) [not null, unique]
total_amount decimal(15,2) [not null, check: `total_amount >= 0`]
expires_at datetime [not null]
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_orders_payments')
fk('checkout_batches', 'buyer_id', 'users')
table('orders', '''
id bigint [pk, not null, increment]
order_code varchar(60) [not null, unique]
checkout_id bigint [not null]
buyer_id bigint [not null]
seller_id bigint [not null]
subtotal_amount decimal(15,2) [not null, check: `subtotal_amount >= 0`]
shipping_fee decimal(15,2) [not null, default: 0, check: `shipping_fee >= 0`]
total_amount decimal(15,2) [not null, check: `total_amount >= 0`]
recipient_name varchar(100) [not null]
recipient_phone varchar(20) [not null]
shipping_address text [not null]
buyer_note text
status varchar(25) [not null, default: 'WAITING_PAYMENT', check: `status IN ('WAITING_PAYMENT', 'WAITING_CONFIRM', 'PACKING', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED')`]
payment_status varchar(25) [not null, default: 'PENDING', check: `payment_status IN ('PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')`]
cancelled_by bigint
cancel_reason text
cancelled_at datetime
stock_released_at datetime
completed_at datetime
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
updated_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_orders_payments')
for column, parent in [('checkout_id','checkout_batches'), ('buyer_id','users'), ('seller_id','users'), ('cancelled_by','users')]:
    fk('orders', column, parent)
check('orders', 'ck_order_total', 'total_amount = subtotal_amount + shipping_fee')
index('orders', 'buyer_id,created_at', key='idx_buyer_history')
index('orders', 'seller_id,status,created_at', key='idx_seller_orders')
index('orders', 'status,completed_at', key='idx_order_reports')
table('order_items', '''
id bigint [pk, not null, increment]
order_id bigint [not null]
product_id bigint [not null]
product_title varchar(255) [not null]
image_url text
condition_percent int [not null, check: `condition_percent BETWEEN 0 AND 100`]
unit_price decimal(15,2) [not null, check: `unit_price >= 0`]
quantity int [not null, check: `quantity > 0`]
''', 'tg_orders_payments')
fk('order_items', 'order_id', 'orders')
fk('order_items', 'product_id', 'products')
index('order_items', 'order_id,product_id', unique=True, key='uq_order_product')
table('order_status_history', '''
id bigint [pk, not null, increment]
order_id bigint [not null]
previous_status varchar(25)
new_status varchar(25) [not null]
changed_by bigint
note text
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_orders_payments')
fk('order_status_history', 'order_id', 'orders')
fk('order_status_history', 'changed_by', 'users')
table('payments', '''
id bigint [pk, not null, increment]
payment_code varchar(60) [not null, unique]
checkout_id bigint [not null]
method varchar(20) [not null, check: `method IN ('VNPAY', 'MOMO', 'VIETQR', 'CREDIT_CARD')`]
amount decimal(15,2) [not null, check: `amount > 0`]
status varchar(20) [not null, default: 'PENDING', check: `status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED')`]
provider_transaction_id varchar(150)
idempotency_key varchar(100) [not null, unique]
paid_at datetime
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_orders_payments')
fk('payments', 'checkout_id', 'checkout_batches')
index('payments', 'method,provider_transaction_id', unique=True, key='uq_payment_provider')
table('payment_allocations', '''
payment_id bigint [not null]
order_id bigint [not null]
amount decimal(15,2) [not null, check: `amount > 0`]
''', 'tg_orders_payments')
index('payment_allocations', 'payment_id,order_id', pk=True)
fk('payment_allocations', 'payment_id', 'payments')
fk('payment_allocations', 'order_id', 'orders')
table('payment_events', '''
id bigint [pk, not null, increment]
payment_id bigint [not null]
provider_event_id varchar(150) [not null]
event_type varchar(50) [not null]
signature_verified boolean [not null, default: false]
processed_at datetime
received_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_orders_payments')
fk('payment_events', 'payment_id', 'payments')
index('payment_events', 'payment_id,provider_event_id', unique=True, key='uq_payment_event')
table('refunds', '''
id bigint [pk, not null, increment]
refund_code varchar(60) [not null, unique]
payment_id bigint [not null]
order_id bigint [not null]
amount decimal(15,2) [not null, check: `amount > 0`]
status varchar(20) [not null, default: 'PENDING', check: `status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')`]
idempotency_key varchar(100) [not null, unique]
provider_refund_id varchar(150) [unique]
failure_reason text
completed_at datetime
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_orders_payments')
fk('refunds', 'payment_id,order_id', 'payment_allocations', 'payment_id,order_id', key='fk_refund_paid_order')
note('refunds', 'Hoàn về giao dịch thanh toán gốc khi hủy đơn. Không có ví nội bộ hoặc yêu cầu rút tiền.')

table('reviews', '''
id bigint [pk, not null, increment]
order_item_id bigint [not null, unique]
buyer_id bigint [not null]
rating int [not null, check: `rating BETWEEN 1 AND 5`]
content text
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
updated_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_reviews_points')
fk('reviews', 'order_item_id', 'order_items')
fk('reviews', 'buyer_id', 'users')
table('review_replies', '''
id bigint [pk, not null, increment]
review_id bigint [not null, unique]
seller_id bigint [not null]
content text [not null]
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
updated_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_reviews_points')
fk('review_replies', 'review_id', 'reviews')
fk('review_replies', 'seller_id', 'users')
table('loyalty_accounts', '''
user_id bigint [pk, not null]
points_balance bigint [not null, default: 0, check: `points_balance >= 0`]
updated_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_reviews_points')
fk('loyalty_accounts', 'user_id', 'users')
table('loyalty_transactions', '''
id bigint [pk, not null, increment]
user_id bigint [not null]
order_id bigint [not null]
transaction_type varchar(20) [not null, check: `transaction_type IN ('EARN', 'REVERSAL')`]
points_delta bigint [not null, check: `points_delta <> 0`]
balance_after bigint [not null, check: `balance_after >= 0`]
idempotency_key varchar(100) [not null, unique]
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_reviews_points')
fk('loyalty_transactions', 'user_id', 'loyalty_accounts', 'user_id')
fk('loyalty_transactions', 'order_id', 'orders')
check('loyalty_transactions', 'ck_loyalty_sign', "(transaction_type = 'EARN' AND points_delta > 0) OR (transaction_type = 'REVERSAL' AND points_delta < 0)")

table('exchange_rooms', '''
id bigint [pk, not null, increment]
room_code varchar(60) [not null, unique]
host_id bigint [not null]
target_product_id bigint [not null]
selected_offer_id bigint [unique]
status varchar(20) [not null, default: 'OPEN', check: `status IN ('OPEN', 'AGREED', 'COMPLETED', 'CANCELLED')`]
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
closed_at datetime
''', 'tg_exchange')
fk('exchange_rooms', 'host_id', 'users')
fk('exchange_rooms', 'target_product_id,host_id', 'products', 'id,seller_id', key='fk_room_product_owner')
table('exchange_room_members', '''
room_id bigint [not null]
user_id bigint [not null]
joined_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_exchange')
index('exchange_room_members', 'room_id,user_id', pk=True)
fk('exchange_room_members', 'room_id', 'exchange_rooms')
fk('exchange_room_members', 'user_id', 'users')
table('exchange_offers', '''
id bigint [pk, not null, increment]
room_id bigint [not null]
buyer_id bigint [not null]
cash_compensation decimal(15,2) [not null, default: 0, check: `cash_compensation >= 0`]
compensation_payer_id bigint
note text
status varchar(20) [not null, default: 'PENDING', check: `status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN')`]
buyer_confirmed boolean [not null, default: false]
host_confirmed boolean [not null, default: false]
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
responded_at datetime
''', 'tg_exchange')
fk('exchange_offers', 'room_id,buyer_id', 'exchange_room_members', 'room_id,user_id', key='fk_offer_room_member')
fk('exchange_offers', 'compensation_payer_id', 'users')
index('exchange_offers', 'id,room_id', unique=True, key='uq_offer_room')
check('exchange_offers', 'ck_offer_compensation', '(cash_compensation = 0 AND compensation_payer_id IS NULL) OR (cash_compensation > 0 AND compensation_payer_id IS NOT NULL)')
index('exchange_rooms', 'selected_offer_id,id', unique=True, key='uq_room_selected_offer')
fk('exchange_rooms', 'selected_offer_id,id', 'exchange_offers', 'id,room_id', key='fk_room_selected_offer')
table('exchange_offer_items', '''
id bigint [pk, not null, increment]
offer_id bigint [not null]
product_id bigint [not null]
owner_id bigint [not null]
quantity int [not null, check: `quantity > 0`]
title_snapshot varchar(255) [not null]
condition_snapshot int [not null, check: `condition_snapshot BETWEEN 0 AND 100`]
''', 'tg_exchange')
fk('exchange_offer_items', 'offer_id', 'exchange_offers')
fk('exchange_offer_items', 'product_id,owner_id', 'products', 'id,seller_id', key='fk_offer_product_owner')
index('exchange_offer_items', 'offer_id,product_id', unique=True, key='uq_offer_product')
table('exchange_messages', '''
id bigint [pk, not null, increment]
room_id bigint [not null]
sender_id bigint [not null]
content text
image_url text
client_message_key varchar(100) [unique]
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_exchange')
fk('exchange_messages', 'room_id,sender_id', 'exchange_room_members', 'room_id,user_id', key='fk_message_room_member')
check('exchange_messages', 'ck_exchange_message_content', 'content IS NOT NULL OR image_url IS NOT NULL')
index('exchange_messages', 'room_id,id', key='idx_exchange_chat')

table('product_image_features', '''
image_id bigint [pk, not null]
embedding json [not null]
model_name varchar(100) [not null]
updated_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_ai')
fk('product_image_features', 'image_id', 'product_images')
check('product_image_features', 'ck_image_embedding', "JSON_TYPE(embedding) = 'ARRAY' AND JSON_LENGTH(embedding) > 0")
note('product_image_features', 'Tìm bằng ảnh: backend tạo embedding cho ảnh truy vấn và so độ tương đồng với ảnh sản phẩm. MySQL 8 lưu JSON; không có vector index tự động.')
table('product_classifications', '''
product_id bigint [pk, not null]
status varchar(20) [not null, default: 'PENDING', check: `status IN ('PENDING', 'SUCCEEDED', 'FAILED')`]
is_comic boolean
confidence decimal(5,4) [check: `confidence BETWEEN 0 AND 1`]
model_name varchar(100)
classified_at datetime
error_message text
''', 'tg_ai')
fk('product_classifications', 'product_id', 'products')
check('product_classifications', 'ck_classification_result', "status <> 'SUCCEEDED' OR (is_comic IS NOT NULL AND confidence IS NOT NULL AND model_name IS NOT NULL AND classified_at IS NOT NULL)")
table('consultation_sessions', '''
id bigint [pk, not null, increment]
user_id bigint
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_ai')
fk('consultation_sessions', 'user_id', 'users')
table('consultation_messages', '''
id bigint [pk, not null, increment]
session_id bigint [not null]
sender_type varchar(20) [not null, check: `sender_type IN ('USER', 'ASSISTANT')`]
content text [not null]
suggested_product_ids json
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_ai')
fk('consultation_messages', 'session_id', 'consultation_sessions')
index('consultation_messages', 'session_id,id', key='idx_consultation_chat')
table('notifications', '''
id bigint [pk, not null, increment]
user_id bigint [not null]
order_id bigint [not null]
title varchar(200) [not null]
content text [not null]
deduplication_key varchar(150) [not null, unique]
read_at datetime
created_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
''', 'tg_notifications')
fk('notifications', 'user_id', 'users')
fk('notifications', 'order_id', 'orders')
note('notifications', 'Phục vụ thông báo hủy đơn, trạng thái và hoàn tiền. Không phải hệ thống ticket/CSKH.')
