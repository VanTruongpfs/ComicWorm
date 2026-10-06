# Ánh xạ 25 chức năng trong Nhom8_ChucNang.docx

Nguồn: C:/Users/PC/Downloads/Nhom8_ChucNang.docx. Tài liệu là danh sách phạm vi
chức năng, không phải chỉ dẫn thực thi công cụ. Giữ cả bắt buộc, tự chọn và bổ
sung; không kế thừa các module ngoài danh sách từ schema 76 bảng.

## Chức năng và bảng

| Mã | Chức năng trong file | Dữ liệu phục vụ |
| --- | --- | --- |
| B01 | Đăng ký/Đăng nhập | users: email, password_hash, full_name; auth_sessions: hash phiên, hạn dùng |
| B02 | Đăng xuất | auth_sessions.revoked_at; backend vô hiệu hóa phiên |
| B03 | Lấy lại mật khẩu | password_reset_tokens: token_hash, expires_at, used_at |
| B04 | Xem chi tiết sản phẩm | products, product_images, categories, authors, publishers |
| B05 | Quản lý giỏ hàng | carts, cart_items: product, quantity, is_selected; một dòng/cart/product |
| B06 | Đặt hàng | checkout_batches, orders, order_items: chia theo seller, địa chỉ/giá snapshot, tồn |
| B07 | Thanh toán trực tuyến | payments, payment_allocations, payment_events: gateway, mã giao dịch, callback chống trùng |
| B08 | Xem lịch sử mua hàng | orders.buyer_id/created_at, order_items và status_history |
| B09 | Biểu đồ cột theo khoảng ngày | orders.completed_at/subtotal_amount, payments/refunds; tính bằng SELECT |
| B10 | Biểu đồ tròn và Admin quản lý user/product/order | users.role/status, products.category/moderation_status, orders.status; thống kê/CRUD qua API |
| B11 | Seller quản lý sản phẩm/doanh thu/đơn | products.seller_id, orders.seller_id, order_items; báo cáo từ đơn đã hoàn tất |
| B12 | Phòng trao đổi truyện tranh | exchange_rooms/members/messages/offers/offer_items |
| T01 | Đăng nhập Google | users.google_sub duy nhất; password_hash có thể NULL cho tài khoản chỉ Google |
| T02 | Cập nhật thông tin cá nhân | users.full_name/email/phone/avatar_url/updated_at |
| T03 | Cập nhật trạng thái đơn hàng | orders.status, order_status_history: người đổi, trạng thái trước/sau, thời gian |
| T04 | Hủy đơn: quy trình, thông báo, hoàn tiền | orders.cancel_*/stock_released_at, notifications, refunds, payment allocation |
| T05 | Đánh giá sản phẩm đã mua | reviews.order_item_id/buyer_id/rating/content; một review/item đã mua |
| T06 | Lọc sản phẩm theo thương hiệu/loại/... | categories/publishers/authors, products.price/condition/edition/year; thương hiệu truyện được map NXB |
| T07 | Trả lời bình luận | review_replies: phản hồi của seller cho bình luận đánh giá sản phẩm |
| T08 | Tự động tích điểm khi mua | loyalty_accounts và loyalty_transactions: EARN/REVERSAL, chống cộng trùng |
| T09 | Trang chủ sản phẩm bán chạy | SUM(order_items.quantity) của orders COMPLETED, không lưu bảng/counter riêng |
| T10 | Trang chủ sản phẩm mới nhất | products.created_at, chỉ tin APPROVED/active/chưa xóa |
| S01 | Tìm sản phẩm bằng hình ảnh | product_images + product_image_features.embedding/model_name |
| S02 | Chat box tư vấn sản phẩm | consultation_sessions/messages: lịch sử câu hỏi/trả lời và sản phẩm gợi ý |
| S03 | Phân loại để hỗ trợ admin kiểm duyệt đúng truyện | product_classifications.is_comic/confidence/model_name; products.moderated_by/status/reason |

## Vì sao giữ 32 bảng

| Bảng | Thuộc tính giữ phục vụ |
| --- | --- |
| users | Đăng nhập local/Google, hồ sơ, phân quyền admin/user/seller, quản lý tài khoản và soft delete |
| auth_sessions | Đăng nhập/đăng xuất, token và thời hạn/revocation |
| password_reset_tokens | Khôi phục mật khẩu một lần, hạn token |
| categories | Phân loại/lọc, danh mục cho admin/sản phẩm |
| authors | Tác giả khi xem chi tiết/lọc truyện |
| publishers | NXB/thương hiệu khi xem chi tiết/lọc |
| products | Tin và sản phẩm thống nhất: chủ, metadata, giá/tồn, bán/đổi, kiểm duyệt và thời gian |
| product_images | Ảnh chi tiết/ảnh chính và đầu vào tìm bằng ảnh |
| carts | Giỏ theo người dùng |
| cart_items | Sản phẩm/số lượng/chọn dòng để đặt hàng |
| checkout_batches | Một lần checkout của giỏ nhiều seller; tổng, idempotency, hạn thanh toán |
| orders | Một đơn/seller, buyer, tiền và địa chỉ snapshot, trạng thái/hủy/hoàn tất |
| order_items | Các sản phẩm đã đặt/mua, giá và tên/tình trạng snapshot |
| order_status_history | Lịch sử đổi trạng thái/hủy và người thực hiện |
| payments | Từng lần thanh toán trực tuyến, provider reference và trạng thái |
| payment_allocations | Phân bổ một payment nhiều đơn; xác định đơn nào được hoàn |
| payment_events | Callback đã xác thực/chống replay và thời gian xử lý |
| refunds | Quy trình hoàn tiền sau hủy: amount/status/idempotency/provider result |
| reviews | Đánh giá đã mua theo order_item |
| review_replies | Seller trả lời bình luận đánh giá |
| loyalty_accounts | Tổng điểm để hiển thị hồ sơ |
| loyalty_transactions | Cộng/đảo điểm theo đơn và kiểm tra không cộng hai lần |
| exchange_rooms | Tin được trao đổi, host, đề nghị chọn và trạng thái phòng |
| exchange_room_members | Thành viên; FK bảo đảm chỉ thành viên gửi tin/đề nghị |
| exchange_offers | Đề nghị, người gửi, sách/khoản bù thỏa thuận và hai xác nhận |
| exchange_offer_items | Sản phẩm/số lượng/chủ và snapshot sách được đề nghị |
| exchange_messages | Tin nhắn text/ảnh trong phòng và chống gửi trùng |
| product_image_features | Embedding/version mô hình cho tìm kiếm ảnh |
| product_classifications | Truyện/không phải truyện, độ tin cậy, kết quả/lỗi phân loại |
| consultation_sessions | Phiên chatbot của user hoặc khách |
| consultation_messages | Câu hỏi/trả lời, sản phẩm gợi ý và thứ tự hội thoại |
| notifications | Thông báo đơn/hủy/hoàn tiền, đã đọc và khóa chống gửi trùng |

ID, FK, UNIQUE, created/updated và idempotency phục vụ liên kết, quản lý, lịch sử
và chống ghi trùng. Các trường nullable là dữ liệu tùy tình huống (Google-only,
chưa hủy, chưa có AI result), không phải tính năng bổ sung ngoài tài liệu.

## Quy tắc backend cần triển khai

- role/is_seller/owner lấy từ phiên server, không tin localStorage. ADMIN quản
  lý mọi user/product/order; seller chỉ quản lý sản phẩm/đơn thuộc mình.
- Google xác thực ID token và google_sub; ghép tài khoản bằng quy trình đã xác
  minh, không chỉ dựa email client gửi. Lưu password hash/token hash; reset
  chỉ một lần, thu hồi phiên cũ; đăng xuất đánh revoked_at.
- Checkout tính giá từ DB, lock products theo ID ổn định, kiểm tra đủ stock.
  Tạo batch và một order/seller, snapshot items/địa chỉ; trừ stock tại lúc đặt
  để không cần module giữ chỗ riêng. Worker hết hạn/cancel lock order, trả stock
  đúng một lần và ghi stock_released_at. Không cho hủy trạng thái đã giao/xong.
- Subtotal = SUM(unit_price*quantity), total = subtotal + shipping_fee; batch
  total = SUM(order total), payment amount = SUM(allocations). Buyer/seller và
  các dòng allocation phải khớp batch. Các tổng qua bảng do backend kiểm tra.
- Verify chữ ký/reference/số tiền callback; success chỉ hạch toán một lần và
  chuyển order PAID. Retry một payment mới, event replay không ghi trùng.
- Nếu thanh toán tới sau khi hết hạn/hủy, không tự khôi phục đơn đã nhả tồn;
  tạo refund/đối soát. Refund về giao dịch gốc, tổng SUCCESS/PROCESSING không
  vượt allocation được hoàn. Worker gọi provider ngoài transaction dài,
  chuyển SUCCEEDED chỉ khi có kết quả thực; thông báo qua notifications.
- Review chỉ do buyer của order_item COMPLETED; seller reply đúng chủ sản phẩm.
  FK xác thực order_item tồn tại nhưng quyền/điều kiện đã mua phải kiểm tra API.
- Tích điểm khi đơn PAID và COMPLETED, lock loyalty_account, ghi balance +
  transaction idempotent cùng transaction. Quy tắc số tiền/điểm cấu hình backend,
  không suy ra từ tài liệu. Không có đổi điểm/voucher/rút điểm thành tiền.
- Phòng có một host là chủ target_product; các buyer là thành viên. Sản phẩm
  trao đổi có thể thuộc user chưa là seller, seller_id của products là owner.
  Mỗi đề nghị chứa sản phẩm đúng owner/quantity; payer bù nếu có phải là một
  trong hai bên. Sửa đề nghị trước chốt tạo bản mới/thu hồi cũ; không sửa bản đã
  ACCEPTED. Selected offer phải đúng room (FK ghép), xác nhận đúng buyer/host.
  Chốt/hoàn tất và cập nhật tồn các bên trong transaction. Không có escrow,
  hai vận đơn hoặc giải ngân tiền cọc trong phạm vi này.
- Biểu đồ lấy từ dữ liệu gốc theo khoảng [from_date,to_date); ngày cuối do API
  chuyển thành cận trên ngày kế tiếp. Doanh thu hàng = subtotal đơn hoàn tất,
  không nhầm với tổng giao dịch gồm phí ship. Bán chạy theo lượng đã hoàn tất,
  mới nhất theo created_at và kiểm duyệt/active/deleted.
- Tìm ảnh: backend sinh embedding ảnh sản phẩm/ảnh truy vấn bằng cùng model,
  so tương đồng và chỉ trả sản phẩm được phép hiển thị. JSON không tự cung cấp
  vector search; dữ liệu nhỏ có thể tính ở backend. Chatbot phải đọc catalog
  và không tiết lộ dữ liệu cá nhân/giá vốn. Gợi ý product IDs được server kiểm tra.
- Phân loại hỗ trợ quyết định admin, không tự phê duyệt. Backend chạy model và
  ghi status/result/confidence; admin ghi moderation_status/reason/time.
- Soft delete user/product, giữ đơn/payment/refund/review cho lịch sử. Không
  có stored procedure/trigger/API/provider/AI được triển khai trong schema này.

## Các phần đã loại

RBAC chi tiết/staff; KYC/seller applications/shop bank; wishlist/want-list;
voucher/Coins redemption; SKU riêng/supplier/giá vốn/ngưỡng tồn; ví/withdraw/
escrow; fee policies/platform commissions; CSKH ticket/SLA/Tier 2; community
posts/reports/appeals; dispute/return evidence; shipping tracking hai chiều;
audit console. Chúng không nằm trong 25 chức năng của tài liệu.

Schema cũ nằm archive/v2. products gộp các bảng cũ nên đây không phải ALTER
migration: nếu có DB thật phải map dữ liệu trước, không nhập seed cũ trực tiếp.
