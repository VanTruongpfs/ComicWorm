# Xác nhận giao dịch trong phòng trao đổi

1. Người đề xuất gửi deal; chủ phòng chọn **Chọn đề xuất này**.
2. Phòng chuyển từ `OPEN` sang `AGREED`. Chọn đề xuất chưa được tính là xác nhận giao dịch.
3. Chủ phòng và người gửi đề xuất được chọn đăng nhập bằng tài khoản riêng, bấm **Xác nhận giao dịch của tôi**. Liên kết **Xem và xác nhận giao dịch** ở đầu phòng dẫn tới bảng xác nhận.
4. Khi cả hai đã xác nhận, phòng chuyển sang `COMPLETED` và hiển thị nút **Tạo đơn vận chuyển**, mở `negotiation-order.html?room=<id>&deal=<offerId>`.

Chỉ hai người trong đề xuất được chọn có quyền xác nhận. API từ chối đề xuất chưa được chọn và phòng đã hủy. Xác nhận lặp lại không tạo thêm tin nhắn. Khóa bản ghi phòng bảo vệ việc chọn đề xuất và hai xác nhận đồng thời. Sự kiện WebSocket được phát sau khi transaction đã commit; khi mất WebSocket, giao diện tải lại trạng thái phòng mỗi 10 giây.

JSON giữ rõ tên trường `isCurrentUserHost`, `isCurrentUserMember` và `isHost`, khớp với JavaScript. Giao diện cũng đọc được tên `currentUserHost` của API cũ. Trạng thái xác nhận chỉ được cập nhật sau khi API thành công.

## Kiểm tra

```powershell
.\gradlew.bat test --tests '*ExchangeRoom*' --offline --console=plain
# Cần Playwright trên NODE_PATH và Chrome; không sửa database.
node tools/verify_exchange_room_browser.cjs
```

Kiểm thử trình duyệt dùng API giả lập trong bộ nhớ cho hai tài khoản và một người quan sát, kiểm tra lỗi API, tải lại trang, mất WebSocket, phòng đóng và phòng rỗng. Báo cáo và ảnh nằm trong `build/reports/exchange-room/`.

## Tạo đơn, admin duyệt và ký quỹ tiền bù

1. Sau khi phòng `COMPLETED`, mỗi bên nhận truyện tạo một đơn COD (`POST /api/exchange/rooms/{id}/orders`): 1 đơn khi mua bằng tiền, 2 đơn khi đổi truyện. Tồn kho của mọi bên được giữ ngay ở đơn đầu tiên.
2. Khi đủ đơn, giao dịch (`exchange_offers.admin_review_status`) chuyển `NOT_SUBMITTED` → `PENDING` và hiện ở trang admin `admin/html/exchange-deals.html`. Bên gửi chỉ bấm được **Xác nhận chuẩn bị hàng** khi `APPROVED`; API trả 409 nếu chưa duyệt. Hai bên vẫn hủy được trước khi gửi hàng.
3. Admin **duyệt** hoặc **từ chối** (bắt buộc lý do). Từ chối sẽ hủy giao dịch: trả tồn kho, hủy đơn và payment. Hai bên nhận thông báo.
4. Khi người trả bù xác nhận đã nhận truyện và trả COD, sàn giữ đúng số tiền bù trong `exchange_escrows` (`HELD`). Phí ship không vào ký quỹ. Khi mọi đơn `COMPLETED`, ký quỹ thành `READY`.
5. Ở tab **Ký quỹ tiền bù**, admin **giải ngân** (chỉ khi `READY`) vào ví của người nhận bù, hoặc **hoàn tiền** (`HELD`/`READY`) vào ví của người trả. Cả hai bắt buộc ghi chú. Ví (`wallets`, `wallet_transactions`) chỉ nhận tiền; chưa có rút tiền. Người dùng xem ở `user/html/wallet.html`.

Mỗi khoản ký quỹ chỉ cộng ví một lần (`wallet_transactions.escrow_id` unique). Thứ tự khóa: phòng, ký quỹ, ví. Giao dịch đã có đơn trước khi có bước duyệt được migration `20261105_exchange_review_escrow.sql` đặt `APPROVED`. Thiết kế: `docs/superpowers/specs/2026-11-05-exchange-admin-review-escrow-design.md`.

Giá trị `COMPLETED` của phòng thể hiện hoàn tất xác nhận thỏa thuận, chưa thể hiện giao hàng hoàn tất.
