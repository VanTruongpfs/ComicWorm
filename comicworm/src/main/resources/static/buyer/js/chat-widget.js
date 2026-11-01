document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("chat-toggle-btn");
    const popup = document.getElementById("chat-popup");
    const closeBtn = document.getElementById("close-chat-btn");
    const clearBtn = document.getElementById("clear-chat-btn");
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const messagesContainer = document.getElementById("chat-messages");
    const quickChipsBar = document.getElementById("chat-quick-chips");

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

    function appendInlineMarkdown(parent, text) {
        const parts = String(text).split(/(\*\*.+?\*\*)/g);
        parts.forEach(part => {
            if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
                const strong = document.createElement("strong");
                strong.textContent = part.slice(2, -2);
                parent.appendChild(strong);
            } else if (part) {
                parent.appendChild(document.createTextNode(part));
            }
        });
    }

    function getStepMatch(line) {
        return line.match(/^\s*(\d+\uFE0F?\u20E3)\s*(.+)$/u);
    }

    function getBulletMatch(line) {
        return line.match(/^\s*(?:•|-)\s+(.+)$/);
    }

    function getTableCells(line) {
        return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
    }

    function isTableSeparator(line) {
        return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
    }

    function isTableStart(lines, index) {
        return index + 1 < lines.length && lines[index].includes("|") && isTableSeparator(lines[index + 1]);
    }

    function renderBotMessage(target, rawText) {
        const lines = String(rawText || "").replace(/\r\n?/g, "\n").split("\n");
        let index = 0;

        while (index < lines.length) {
            const line = lines[index];
            if (!line.trim()) {
                index += 1;
                continue;
            }

            if (isTableStart(lines, index)) {
                const tableWrap = document.createElement("div");
                tableWrap.className = "bot-table-wrap";
                const table = document.createElement("table");
                const head = document.createElement("thead");
                const headerRow = document.createElement("tr");
                getTableCells(lines[index]).forEach(cellText => {
                    const cell = document.createElement("th");
                    appendInlineMarkdown(cell, cellText);
                    headerRow.appendChild(cell);
                });
                head.appendChild(headerRow);
                table.appendChild(head);

                const body = document.createElement("tbody");
                index += 2;
                while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
                    const row = document.createElement("tr");
                    getTableCells(lines[index]).forEach(cellText => {
                        const cell = document.createElement("td");
                        appendInlineMarkdown(cell, cellText);
                        row.appendChild(cell);
                    });
                    body.appendChild(row);
                    index += 1;
                }
                table.appendChild(body);
                tableWrap.appendChild(table);
                target.appendChild(tableWrap);
                continue;
            }

            if (getStepMatch(line)) {
                const stepper = document.createElement("ol");
                stepper.className = "bot-stepper";
                while (index < lines.length) {
                    const match = getStepMatch(lines[index]);
                    if (!match) break;

                    const step = document.createElement("li");
                    step.className = "bot-step";
                    const marker = document.createElement("span");
                    marker.className = "bot-step-marker";
                    marker.textContent = match[1];
                    const copy = document.createElement("span");
                    copy.className = "bot-step-copy";
                    appendInlineMarkdown(copy, match[2]);
                    step.append(marker, copy);
                    stepper.appendChild(step);
                    index += 1;
                }
                target.appendChild(stepper);
                continue;
            }

            if (getBulletMatch(line)) {
                const list = document.createElement("ul");
                list.className = "bot-bullet-list";
                while (index < lines.length) {
                    const match = getBulletMatch(lines[index]);
                    if (!match) break;
                    const item = document.createElement("li");
                    appendInlineMarkdown(item, match[1]);
                    list.appendChild(item);
                    index += 1;
                }
                target.appendChild(list);
                continue;
            }

            if (/^\s*>\s?/.test(line)) {
                const policy = document.createElement("blockquote");
                policy.className = "bot-policy-block";
                while (index < lines.length && /^\s*>/.test(lines[index])) {
                    const item = document.createElement("p");
                    appendInlineMarkdown(item, lines[index].replace(/^\s*>\s?/, ""));
                    policy.appendChild(item);
                    index += 1;
                }
                target.appendChild(policy);
                continue;
            }

            const heading = line.match(/^\s{0,3}#{1,3}\s+(.+)$/);
            if (heading) {
                const title = document.createElement("h4");
                title.className = "bot-message-heading";
                appendInlineMarkdown(title, heading[1]);
                target.appendChild(title);
                index += 1;
                continue;
            }

            const paragraph = document.createElement("p");
            paragraph.className = "bot-paragraph";
            let firstLine = true;
            while (index < lines.length && lines[index].trim()
                && !getStepMatch(lines[index])
                && !getBulletMatch(lines[index])
                && !isTableStart(lines, index)
                && !/^\s*>/.test(lines[index])
                && !/^\s{0,3}#{1,3}\s+/.test(lines[index])) {
                if (!firstLine) paragraph.appendChild(document.createElement("br"));
                appendInlineMarkdown(paragraph, lines[index]);
                firstLine = false;
                index += 1;
            }
            target.appendChild(paragraph);
        }
    }

    function appendProductBadge(container, text, className) {
        const badge = document.createElement("span");
        badge.className = `badge ${className}`;
        badge.textContent = text;
        container.appendChild(badge);
    }

    // Render bot replies and product suggestions from the API response.
    function appendMessageUI(sender, text, products = null) {
        const isBot = sender !== "user";
        const msgDiv = document.createElement("div");
        msgDiv.className = `msg ${isBot ? "msg-bot" : "msg-user"}`;
        if (isBot) renderBotMessage(msgDiv, text);
        else msgDiv.textContent = text;
        messagesContainer.appendChild(msgDiv);

        if (products && Array.isArray(products) && products.length > 0) {
            const listDiv = document.createElement("div");
            listDiv.className = "product-suggestions";

            products.forEach(product => {
                const card = document.createElement("a");
                card.className = "product-card-mini";
                card.href = `product_details.html?id=${encodeURIComponent(product.id)}`;

                const image = document.createElement("img");
                image.src = product.coverImageUrl || "/shared/images/default-book.png";
                image.alt = product.title || "Ảnh bìa sản phẩm";
                image.loading = "lazy";
                image.addEventListener("error", () => image.remove(), { once: true });
                card.appendChild(image);

                const info = document.createElement("div");
                info.className = "product-card-info";

                const title = document.createElement("h4");
                title.textContent = product.title || "Sản phẩm";
                info.appendChild(title);

                const price = document.createElement("div");
                price.className = "price";
                const priceValue = Number(product.price);
                price.textContent = Number.isFinite(priceValue)
                    ? `${priceValue.toLocaleString("vi-VN")} đ`
                    : "Chưa có giá";
                info.appendChild(price);

                const badges = document.createElement("div");
                badges.className = "card-badge-container";
                const stock = Number(product.stockQuantity);
                if (Number.isFinite(stock)) {
                    appendProductBadge(badges, stock > 0 ? `Còn ${stock} cuốn` : "Hết hàng",
                        stock > 0 ? "badge-stock-in" : "badge-stock-out");
                }

                const condition = Number(product.conditionPercent);
                if (Number.isFinite(condition)) {
                    const grade = condition >= 100 ? "NEW" : condition >= 98 ? "LIKE NEW" : "USED";
                    appendProductBadge(badges, `${condition}% - ${grade}`, "badge-condition");
                }

                const listingLabel = product.listingType === "TRADE"
                    ? "Giao lưu / Trade"
                    : product.listingType === "SELL_AND_TRADE"
                        ? "Bán & giao lưu"
                        : "Đăng bán";
                appendProductBadge(badges, listingLabel, "badge-listing");
                info.appendChild(badges);

                const details = [product.volumeNumbers, product.editionType, product.authorName, product.categoryName]
                    .filter(value => value != null && String(value).trim() !== "");
                if (details.length > 0) {
                    const metadata = document.createElement("div");
                    metadata.className = "product-card-meta";
                    metadata.textContent = details.join(" | ");
                    info.appendChild(metadata);
                }

                card.appendChild(info);
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
                    const botReplyText = data.botReply || "Không có phản hồi từ hệ thống.";
                    const suggestedProducts = Array.isArray(data.suggestedProducts)
                        ? data.suggestedProducts
                        : [];

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

    if (quickChipsBar && form && input) {
        quickChipsBar.addEventListener("click", event => {
            const chip = event.target.closest(".quick-chip");
            if (!chip) return;
            input.value = chip.dataset.message || "";
            form.requestSubmit();
        });
    }

    // Nạp lịch sử lần đầu khi tải trang
    loadHistory();
});