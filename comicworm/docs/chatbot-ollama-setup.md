# Cấu hình chatbot với Ollama trên Windows

Chatbot ComicWorm dùng model `qwen-comicworm` chạy trên Ollama local. Chỉ cần
cài Ollama và tải file model một lần. Khi chạy `bootRun` với profile `local`,
ứng dụng tự khởi động Ollama, tự tạo model nếu chưa có và nạp sẵn model vào bộ
nhớ, giống cách tìm kiếm bằng hình ảnh tự khởi động dịch vụ CLIP.

## 1. Cài Ollama

Mở **PowerShell** trên Windows và chạy lệnh cài đặt:

```powershell
irm https://ollama.com/install.ps1 | iex
```

Sau khi cài xong, mở một cửa sổ PowerShell mới và kiểm tra:

```powershell
ollama --version
```

Ứng dụng tìm `ollama.exe` trong `PATH` và trong thư mục cài đặt mặc định
`%LOCALAPPDATA%\Programs\Ollama`. Nếu cài ở chỗ khác, đặt
`app.chatbot.ollama.executable` thành đường dẫn đầy đủ tới `ollama.exe`.

## 2. Tải các file model

Mở [thư mục chia sẻ trên Google Drive](https://drive.google.com/drive/folders/1CB4vgtY6bf2G3o69JiuWchQyigZMYgTA?usp=sharing)
và tải về cả hai file:

- `Modelfile`
- File model có đuôi `.gguf` (GGUF)

Đặt cả hai file vào thư mục `comicworm/chatbot/`. Thư mục này đã được Git bỏ
qua, nên file `.gguf` khoảng 1,8 GB sẽ không bị commit.

> Nếu tên file `.gguf` khác tên được tham chiếu trong `Modelfile`, cập nhật
> dòng `FROM` trong `Modelfile` để trỏ đúng tên file, ví dụ
> `FROM ./ten-model.gguf`.

## 3. Kiểm tra cấu hình

`application-local.properties` (sao chép từ `application-local.example.properties`)
cần có các dòng:

```properties
spring.ai.openai.base-url=http://localhost:11434
spring.ai.openai.api-key=ollama
spring.ai.openai.chat.options.model=qwen-comicworm
spring.ai.openai.chat.options.temperature=0.0
app.chatbot.ollama.auto-start=true
app.chatbot.ollama.model-directory=chatbot
```

Spring AI gửi yêu cầu theo API tương thích OpenAI của Ollama local. Không cần
thay `api-key` bằng khóa của dịch vụ đám mây.

## 4. Chạy ComicWorm

Đảm bảo MySQL và các cấu hình local cần thiết của dự án đã sẵn sàng. Tại thư
mục `comicworm`, chạy:

```powershell
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

Sau khi web khởi động, một luồng nền xử lý Ollama mà không làm chậm web:

1. Nếu Ollama đang chạy ở `localhost:11434` (ví dụ ứng dụng Ollama ở khay hệ
   thống), dùng luôn server đó. Nếu chưa chạy, khởi động `ollama serve`.
2. Nếu chưa có model `qwen-comicworm`, chạy
   `ollama create qwen-comicworm -f Modelfile` trong `comicworm/chatbot/`.
   Việc này chỉ cần làm một lần và mất khoảng một phút.
3. Nạp model vào bộ nhớ để câu hỏi đầu tiên không phải chờ.

Tiến trình và lỗi được ghi vào log của Spring và `build/logs/ollama.log`. Khi
dừng ứng dụng, chỉ server `ollama serve` do ứng dụng khởi động mới bị tắt;
Ollama đã chạy từ trước không bị ảnh hưởng.

Nếu chatbot không phản hồi, xem các dòng log của `OllamaProcessManager` và
kiểm tra `ollama list` có `qwen-comicworm`. Để tự quản lý Ollama bằng tay, đặt
`app.chatbot.ollama.auto-start=false` rồi tự chạy `ollama create` như ở bước 2.

## Kiểm thử

```powershell
.\gradlew.bat test --tests '*OllamaProcessManager*' --console=plain
# Chạy Ollama thật ở một cổng trống, tạo rồi xóa model tạm qwen-comicworm-livetest.
$env:OLLAMA_AUTOSTART_LIVE_TEST = 'true'
.\gradlew.bat test --tests '*OllamaProcessManager*' --console=plain
```
