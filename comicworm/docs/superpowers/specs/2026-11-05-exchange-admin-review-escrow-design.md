# Duyệt đơn trao đổi và ký quỹ tiền bù

Ngày: 2026-11-05. Trạng thái: đã được duyệt trong chat, triển khai ngay.

## Mục tiêu

1. Admin duyệt giao dịch trao đổi sau khi hai bên tạo đủ đơn nhận truyện và trước khi bên gửi chuẩn bị hàng.
2. Tiền bù của giao dịch trao đổi đi qua ký quỹ: sàn giữ tiền khi người trả bù thanh toán COD, admin giải ngân
   vào ví trong app của người nhận hoặc hoàn vào ví của người trả.

Ngoài phạm vi: rút tiền khỏi ví, phí sàn, tranh chấp có bằng chứng. Phí ship không vào ký quỹ.

## Dữ liệu

- `exchange_offers` thêm `admin_review_status` (`NOT_SUBMITTED`, `PENDING`, `APPROVED`, `REJECTED`; mặc định
  `NOT_SUBMITTED`), `reviewed_by`, `reviewed_at`, `review_note` (bắt buộc khi `REJECTED`).
- `exchange_escrows`: một dòng cho mỗi đề xuất (`offer_id` unique), `room_id`, `payer_id`, `payee_id`,
  `source_order_id`, `amount > 0`, `status` (`HELD`, `READY`, `RELEASED`, `REFUNDED`), `held_at`, `ready_at`,
  `resolved_at`, `resolved_by`, `resolution_note` (bắt buộc khi đã giải ngân/hoàn).
- `wallets`: `user_id` (PK), `balance >= 0`, `updated_at`.
- `wallet_transactions`: `user_id`, `amount > 0`, `type` (`ESCROW_RELEASE`, `ESCROW_REFUND`), `escrow_id`
  (unique, mỗi khoản ký quỹ chỉ cộng ví một lần), `balance_after`, `note`, `created_at`.
- Migration `20261105_exchange_review_escrow.sql`: các giao dịch đã có đơn trước thay đổi được đặt `APPROVED`.

## Luồng

1. Đơn nhận truyện cuối cùng cần thiết được tạo (1 đơn khi mua bằng tiền, 2 khi đổi truyện), giao dịch chuyển
   `NOT_SUBMITTED` sang `PENDING`.
2. Chưa `APPROVED` thì `ACCEPT`/`SHIP` trả 409. Hai bên vẫn hủy được như cũ. Giao dịch còn `NOT_SUBMITTED` mà đã
   đủ đơn là giao dịch tạo trước bước duyệt (ví dụ cột được ddl-auto thêm mà chưa chạy migration): được coi là
   `APPROVED` như migration làm, để không bị kẹt. (Không thể chuyển nó sang `PENDING` trong cùng request trả 409
   vì transaction sẽ rollback.)
3. Admin duyệt: `APPROVED`, thông báo hai bên. Admin từ chối (bắt buộc lý do): `REJECTED`, hủy giao dịch bằng logic
   hủy hiện có (trả tồn kho, hủy đơn và payment), thông báo hai bên kèm lý do.
4. Người trả bù xác nhận nhận hàng và trả COD, tiền bù > 0: tạo ký quỹ `HELD` (idempotent theo `offer_id`).
5. Mọi đơn của giao dịch `COMPLETED`: ký quỹ `HELD` sang `READY`.
6. Admin giải ngân (chỉ `READY`) cộng ví người nhận bù, `RELEASED`. Admin hoàn tiền (`HELD` hoặc `READY`) cộng ví
   người trả bù, `REFUNDED`. Bắt buộc ghi chú; khóa dòng ký quỹ rồi dòng ví; thông báo cho người được cộng tiền.

Thứ tự khóa: phòng, rồi ký quỹ, rồi ví.

## API

- `GET /api/admin/exchange/csrf`
- `GET /api/admin/exchange/deals?status=PENDING|APPROVED|REJECTED`
- `POST /api/admin/exchange/deals/{offerId}/approve`, `POST .../reject` `{reason}`
- `GET /api/admin/exchange/escrows?status=ALL|HELD|READY|RELEASED|REFUNDED` (kèm tổng tiền theo trạng thái)
- `POST /api/admin/exchange/escrows/{id}/release` `{note}`, `POST .../refund` `{note}`
- `GET /api/wallet/me`: số dư và lịch sử của người đăng nhập.
- `GET /api/exchange/orders` bổ sung trạng thái duyệt, lý do và ký quỹ của từng giao dịch.

`/api/admin/**` đã yêu cầu `ROLE_ADMIN` và CSRF khi ghi.

## Giao diện

- `admin/html/exchange-deals.html`: tab "Duyệt đơn trao đổi" và "Ký quỹ"; thêm vào sidebar admin.
- `exchange/html/exchange-orders.html`: hiện trạng thái duyệt, lý do từ chối, trạng thái ký quỹ; ẩn nút chuẩn bị
  hàng khi chưa duyệt.
- `user/html/wallet.html`: số dư và lịch sử ví; mục "Ví & Rút tiền" của sidebar người dùng trỏ về trang này.

## Kiểm thử

Unit test Mockito: chuyển `PENDING` khi đủ đơn, chặn `ACCEPT` khi chưa duyệt, từ chối hủy giao dịch, tạo ký quỹ
khi nhận COD, chuyển `READY`, giải ngân/hoàn cộng đúng ví và không cộng hai lần, trạng thái sai trả 409. Test bảo
mật `@WebMvcTest`: không phải admin nhận 403.
