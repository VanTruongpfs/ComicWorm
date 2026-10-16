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

## Phạm vi bước tạo đơn

Các trang `negotiation-order`, `shipping-fee` và `exchange-orders` hiện vẫn là giao diện dữ liệu mẫu; chưa có API tạo đơn trao đổi từ đề xuất được chọn. Nút trong phòng mở bước tạo đơn với đúng mã phòng và đề xuất, chưa lưu đơn vận chuyển thật vào MySQL. Giá trị `COMPLETED` ở đây thể hiện hoàn tất xác nhận thỏa thuận, chưa thể hiện giao hàng hoàn tất.
