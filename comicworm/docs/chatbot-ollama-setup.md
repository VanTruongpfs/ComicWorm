# Cấu hình chatbot với Ollama trên Windows

Hướng dẫn này cài Ollama, tạo model `qwen-comicworm` từ các file được chia sẻ
và chạy chatbot ComicWorm trên máy local.

## 1. Cài Ollama

Mở **PowerShell** trên Windows và chạy lệnh cài đặt:

```powershell
irm https://ollama.com/install.ps1 | iex
```

Sau khi cài xong, mở một cửa sổ PowerShell mới và kiểm tra:

```powershell
ollama --version
```

## 2. Tải các file model

Mở [thư mục chia sẻ trên Google Drive](https://drive.google.com/drive/folders/1CB4vgtY6bf2G3o69JiuWchQyigZMYgTA?usp=sharing)
và tải về cả hai file:

- `Modelfile`
- File model có đuôi `.gguf` (GGUF)

> Đảm bảo tải đủ cả hai file. Nếu tên file `.gguf` khác tên được tham chiếu
> trong `Modelfile`, cập nhật dòng `FROM` trong `Modelfile` để trỏ đúng tên
> file, ví dụ `FROM ./ten-model.gguf`.

Tạo một thư mục trên máy, ví dụ `C:\ollama-models\qwen-comicworm`, rồi đặt
cả `Modelfile` và file `.gguf` vào trong thư mục đó.

## 3. Tạo model Ollama

Mở PowerShell tại thư mục chứa hai file. Có thể mở thư mục trong File Explorer,
nhấn vào thanh địa chỉ, nhập `powershell`, rồi nhấn Enter.

Kiểm tra các file đã có:

```powershell
Get-ChildItem
```

Tạo model với tên mà ứng dụng đang cấu hình:

```powershell
ollama create qwen-comicworm -f Modelfile
```

Chờ lệnh hoàn tất thành công, sau đó kiểm tra model:

```powershell
ollama list
```

Có thể chạy thử model trước khi mở ứng dụng:

```powershell
ollama run qwen-comicworm
```

Nhập một câu hỏi để xác nhận model phản hồi; nhập `/bye` để thoát. Trên
Windows, Ollama thường tiếp tục chạy nền sau khi cài đặt. Chatbot cần Ollama
đang hoạt động và API local có thể truy cập tại `http://localhost:11434`.

## 4. Kiểm tra cấu hình Spring Boot

Mở `src/main/resources/application.properties` và đảm bảo có các dòng:

```properties
spring.ai.openai.base-url=http://localhost:11434
spring.ai.openai.api-key=ollama
spring.ai.openai.chat.options.model=qwen-comicworm
spring.ai.openai.chat.options.temperature=0.0
```

Các giá trị này khiến Spring AI gửi yêu cầu theo API tương thích OpenAI của
Ollama local, dùng model `qwen-comicworm`. Không cần thay `api-key` bằng khóa
của dịch vụ đám mây.

## 5. Chạy ComicWorm

Đảm bảo MySQL và các cấu hình local cần thiết của dự án đã sẵn sàng. Tại thư
mục `comicworm`, chạy:

```powershell
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

Mở giao diện ComicWorm và sử dụng chatbot. Nếu chatbot không phản hồi, hãy
kiểm tra Ollama có đang chạy hay không, model `qwen-comicworm` có trong kết
quả `ollama list` hay không, và địa chỉ `http://localhost:11434` có truy cập
được trên máy.
