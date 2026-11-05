# Hủy đơn và yêu cầu hoàn tiền sau khi giao (T04)

Ngày: 2026-11-05 · Trạng thái: đã duyệt thiết kế trong chat

## Mục tiêu

- Người mua hủy được đơn khi hàng **chưa bàn giao vận chuyển**: `WAITING_PAYMENT`,
  `WAITING_CONFIRM`, `PACKING`.
- Trong **7 ngày** sau khi giao thành công, người mua gửi được **một** yêu cầu hoàn tiền
  kèm lý do. Người bán đồng ý hoặc từ chối (từ chối phải có lý do).
- Đây là **bản demo**: người bán đồng ý thì đơn chuyển ngay sang "Đã hoàn tiền", không
  chờ cổng thanh toán. Áp dụng cho cả VNPay và COD.

### Ngoài phạm vi

Gửi trả hàng, bằng chứng/ảnh, khiếu nại lên admin, admin đổi kết quả, tự động đồng ý khi
người bán không phản hồi, hoàn tiền một phần, gửi lại yêu cầu sau khi bị từ chối.

## Hiện trạng

- `OrderCancellationService` đã hủy đơn, nhả tồn kho, tạo `Refund` khi đã trả online,
  thông báo bên kia. Người mua hiện chỉ hủy được ở `WAITING_PAYMENT`/`WAITING_CONFIRM`.
- `RefundProcessor` xử lý `Refund` `PENDING` mỗi 30s qua `MockRefundGateway`.
- `LoyaltyService.reverseForRefund` đã có nhưng chưa ai gọi.
- `OrderAutoCompletionJob` tự hoàn tất đơn 7 ngày sau `SHIPPING`/`DELIVERED`.

## Thiết kế

### Dữ liệu

Thêm 5 cột vào `orders` (cập nhật `schema_model.py`, migration
`database/migrations/20261105_order_refund_requests.sql`, tăng số cột ở
`verify_scope_mysql.py`). Trạng thái đơn (`status`) không đổi khi hoàn tiền; chỉ
`payment_status` chuyển `REFUNDED`.

| Cột | Kiểu |
| --- | --- |
| `refund_request_status` | `varchar(20)` null, `PENDING`/`APPROVED`/`REJECTED` |
| `refund_request_reason` | `text` null, lý do của người mua |
| `refund_reject_reason` | `text` null, lý do người bán từ chối |
| `refund_requested_at` | `datetime` null |
| `refund_decided_at` | `datetime` null |

### Mốc 7 ngày

Mốc giao hàng = `created_at` sớm nhất trong `order_status_history` có `new_status` là
`DELIVERED` hoặc `COMPLETED`. Hạn = mốc + 7 ngày (`app.order.refund-request-days`, mặc
định 7). Không có mốc thì chưa được yêu cầu.

### Service `OrderRefundRequestService`

- `request(orderCode, buyerId, reason)`: khóa đơn; đúng người mua; không phải đơn trao
  đổi; trạng thái `DELIVERED`/`COMPLETED`; `payment_status` khác `REFUNDED`; chưa có yêu
  cầu; còn hạn; lý do 1–500 ký tự. Ghi `PENDING`, thông báo người bán.
- `approve(orderCode, sellerId)`: đúng người bán; yêu cầu `PENDING`. Ghi `APPROVED`,
  `payment_status = REFUNDED`. Với mỗi allocation của đơn tạo `Refund` `SUCCEEDED`
  (`provider_refund_id = "DEMO-" + refundCode`, idempotency `REFUND:RETURN:ORDER:{id}:PAYMENT:{pid}`),
  gọi `reverseForRefund`, thông báo người mua "Hoàn tiền thành công".
- `reject(orderCode, sellerId, reason)`: đúng người bán; `PENDING`; lý do bắt buộc.
  Ghi `REJECTED`, thông báo người mua kèm lý do.

Lỗi trả `ResponseStatusException` (404 không thấy/không phải chủ, 409 sai trạng thái/quá
hạn/đã có yêu cầu, 400 lý do không hợp lệ), giống luồng hủy.

### API

- `POST /api/orders/{code}/refund-request` `{reason}`: người mua đã đăng nhập.
- `POST /api/seller/orders/{code}/refund-request/approve`
- `POST /api/seller/orders/{code}/refund-request/reject` `{reason}`

`/api/seller/**` đã yêu cầu `ROLE_SELLER` và CSRF. Thêm matcher `authenticated()` cho
đường dẫn của người mua trong `SecurityConfig`.

`OrderDTOs.Summary` thêm `refundRequestStatus`, `refundRequestReason`,
`refundRejectReason`, `refundEligibleUntil` (null nếu không còn được yêu cầu).

### Giao diện

- `buyer/js/page2.js`: `canCancelOrder` gồm `PACKING`. Nút "Yêu cầu hoàn tiền" khi
  `refundEligibleUntil` khác null, mở hộp thoại nhập lý do. Thẻ và chi tiết đơn hiện trạng
  thái yêu cầu (chờ duyệt / đã hoàn tiền / bị từ chối + lý do).
- `seller/js/orders-live.js`: đơn có yêu cầu `PENDING` hiện nhãn, chi tiết hiện lý do và
  nút Đồng ý / Từ chối (từ chối hỏi lý do).

## Kiểm thử

Mockito cho `OrderRefundRequestService`: quá hạn, chưa giao, sai người mua, gửi lần hai,
đồng ý (đơn `REFUNDED`, tạo refund, trừ điểm, thông báo), từ chối (thiếu lý do, sai người
bán). Sửa `OrderCancellationServiceTests` cho người mua hủy ở `PACKING`.
