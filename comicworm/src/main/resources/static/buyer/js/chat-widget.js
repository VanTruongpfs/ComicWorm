document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("chat-toggle-btn");
    const popup = document.getElementById("chat-popup");
    const closeBtn = document.getElementById("close-chat-btn");
    const clearBtn = document.getElementById("clear-chat-btn");
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const messagesContainer = document.getElementById("chat-messages");

    // Kiểm tra an toàn xem các phần tử HTML đã tồn tại chưa
    if (!toggleBtn || !popup || !messagesContainer) return;

    const STORAGE_KEY = "comicworm_chat_history";

    // 1. Đóng / Mở popup và tự động nạp lại lịch sử
    toggleBtn.addEventListener("click", () => {
        popup.classList.toggle("hidden");
        if (!popup.classList.contains("hidden")) {
            loadHistory(); // Nạp lại lịch sử mỗi khi mở cửa sổ chat
            if (input) input.focus();
            scrollToBottom();
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            popup.classList.add("hidden");
        });
    }

    // 2. Tải lịch sử trò chuyện từ LocalStorage (Có kiểm tra lỗi an toàn)
    function loadHistory() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;

        try {
            const history = JSON.parse(saved);
            if (!Array.isArray(history) || history.length === 0) return;

            messagesContainer.innerHTML = ""; // Xóa tin nhắn mặc định

            history.forEach(item => {
                appendMessageUI(item.sender, item.text, item.products);
            });
            scrollToBottom();
        } catch (error) {
            console.error("Lỗi khi đọc lịch sử từ LocalStorage:", error);
        }
    }

    // 3. Lưu thêm 1 mục vào LocalStorage
    function saveToHistory(sender, text, products = null) {
        try {
            let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            history.push({ sender, text, products });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (error) {
            console.error("Lỗi khi ghi lịch sử vào LocalStorage:", error);
        }
    }

    // 4. Xóa toàn bộ lịch sử
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (confirm("Bạn có muốn làm mới cuộc trò chuyện?")) {
                localStorage.removeItem(STORAGE_KEY);
                messagesContainer.innerHTML = `
                    <div class="msg msg-bot">
                        Xin chào! Tôi có thể giúp bạn tìm kiếm cuốn truyện tranh nào hôm nay?
                    </div>
                `;
            }
        });
    }

    // 5. Thêm bong bóng chat vào giao diện
    function appendMessageUI(sender, text, products = null) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `msg ${sender === "user" ? "msg-user" : "msg-bot"}`;
        msgDiv.innerText = text;
        messagesContainer.appendChild(msgDiv);

        // Hiển thị danh sách sản phẩm gợi ý (nếu có)
        if (products && Array.isArray(products) && products.length > 0) {
            const listDiv = document.createElement("div");
            listDiv.className = "product-suggestions";

            products.forEach(p => {
                const card = document.createElement("div");
                card.className = "product-card-mini";
                card.innerHTML = `
                    <img src="${p.imageUrl || '/shared/images/default-book.png'}" alt="${p.name || p.title}">
                    <div class="product-card-info">
                        <h4>${p.name || p.title}</h4>
                        <div class="price">${Number(p.price || 0).toLocaleString('vi-VN')} đ</div>
                    </div>
                `;
                listDiv.appendChild(card);
            });

            messagesContainer.appendChild(listDiv);
        }

        scrollToBottom();
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 6. Gửi tin nhắn qua API (Đã tối ưu đính kèm Token linh hoạt)
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;

            // Hiển thị tin nhắn người dùng và lưu LocalStorage
            appendMessageUI("user", text);
            saveToHistory("user", text);
            input.value = "";

            // Hiệu ứng đang gõ...
            const typingIndicator = document.createElement("div");
            typingIndicator.className = "msg msg-bot";
            typingIndicator.id = "typing-loading";
            typingIndicator.innerText = "Trợ lý đang tìm kiếm...";
            messagesContainer.appendChild(typingIndicator);
            scrollToBottom();

            try {
                // Lấy accessToken từ LocalStorage hoặc SessionStorage
                const token = localStorage.getItem("accessToken") || localStorage.getItem("token");

                const headers = {
                    "Content-Type": "application/json"
                };

                // Chỉ truyền Authorization header nếu thực sự có token hợp lệ
                if (token && token !== "null" && token !== "undefined") {
                    headers["Authorization"] = `Bearer ${token}`;
                }

                const response = await fetch("/api/chat", {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({ message: text })
                });

                const data = await response.json(); // Nhận BotChatResponseDTO từ Backend
                typingIndicator.remove();

                if (response.ok) {
                    // Trích xuất đúng tên trường botReply và suggestedProducts từ DTO
                    const botReplyText = data.botReply || data.message || "Không có phản hồi từ hệ thống.";
                    const suggestedProducts = data.suggestedProducts || data.products || [];

                    appendMessageUI("bot", botReplyText, suggestedProducts);
                    saveToHistory("bot", botReplyText, suggestedProducts);
                } else if (response.status === 401) {
                    appendMessageUI("bot", "Phiên đăng nhập của bạn đã hết hạn hoặc không hợp lệ. Vui lòng thử lại!");
                } else {
                    appendMessageUI("bot", "Rất tiếc, đã có lỗi xảy ra. Vui lòng thử lại!");
                }
            } catch (error) {
                typingIndicator.remove();
                appendMessageUI("bot", "Không thể kết nối đến máy chủ.");
            }
        });
    }

    // Nạp lịch sử lần đầu khi tải trang
    loadHistory();
});