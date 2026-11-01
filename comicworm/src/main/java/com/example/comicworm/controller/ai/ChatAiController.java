package com.example.comicworm.controller.ai;

import com.example.comicworm.dto.request.ai.ChatRequestDTO;
import com.example.comicworm.dto.request.ai.ProductSearchRequestAI;
import com.example.comicworm.dto.response.ProductCardDTO;
import com.example.comicworm.dto.response.ai.BotChatResponseDTO;
import com.example.comicworm.dto.response.ai.ProductChatSummaryDTO;
import com.example.comicworm.dto.response.ai.ProductSearchResponseAI;
import com.example.comicworm.service.ai.ProductSearchTool;
import com.example.comicworm.service.product.IProductService;
import com.example.comicworm.utils.ConditionGrade;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Controller Chatbot tư vấn truyện tranh ComicWorm sử dụng mô hình Qwen 2.5 QLoRA cục bộ qua Ollama.
 * Phân loại 10 Intent nghiệp vụ & trích xuất Slots qua Ollama NLU, sau đó sinh phản hồi mẫu chuyên nghiệp
 * theo từng ngữ cảnh dữ liệu thực tế mà hoàn toàn không phụ thuộc vào Gemini API.
 */
@RestController
@RequestMapping("/api")
public class ChatAiController {

    private static final Logger log = LoggerFactory.getLogger(ChatAiController.class);

    @Value("${spring.ai.openai.chat.options.model:qwen-comicworm}")
    private String modelName;

    private static final String NLU_SYSTEM_PROMPT = """
            Bạn là bộ phân loại ý định và trích xuất thực thể (NLU) cho hệ thống sàn truyện tranh ComicWorm.
            Nhiệm vụ: Phân loại ý định người dùng (intent) và trích xuất thông tin (slots) ra JSON chuẩn.

            BẮT BUỘC chỉ được chọn 1 trong 10 INTENT sau:
            1. SEARCH_COMIC: Tìm kiếm truyện theo tên, từ khóa chung.
            2. FILTER_PRICE: Tìm truyện theo khoảng giá, tình trạng, số tập.
            3. CHECK_STOCK: Kiểm tra tồn kho của truyện/tập truyện.
            4. ASK_EDITION: Hỏi về phiên bản (bìa cứng, bìa mềm, bản đặc biệt, boxset).
            5. CHECK_CONDITION: Hỏi quy định/đánh giá tình trạng truyện (mới, cũ, like new).
            6. NEWEST_COMIC: Tìm truyện mới cập nhật, mới lên kệ.
            7. POPULAR_BESTSELLER: Tìm truyện hot, bán chạy, thịnh hành.
            8. POLICY_INQUIRY: Hỏi chính sách mua bán, giao hàng, đổi trả, tích điểm, hoàn tất đơn.
            9. TRADE_EXCHANGE_INQUIRY: Hỏi quy trình trao đổi/đổi truyện C2C (Exchange Room).
            10. GREETING_CHITCHAT: Chào hỏi, cảm ơn, trò chuyện xã giao.

            Các trường slots có thể trích xuất (nếu có):
            - keyword: Tên truyện, tên tác giả hoặc từ khóa chính (String)
            - maxPrice: Mức giá tối đa người dùng tìm (Number)
            - minConditionPercent: Tình trạng tối thiểu dạng số % (Number: 0 - 100)
            - conditionGrade: Cấp độ tình trạng (NEW, LIKE_NEW, GOOD, USED)
            - volumeNumbers: Số tập hoặc tập truyện cần tìm (String)
            - editionType: Phiên bản bìa/loại ấn bản (String)
            - listingType: Hình thức đăng (SALE hoặc TRADE)
            - limit: Số lượng yêu cầu (Number)

            CHỈ trả về kết quả JSON duy nhất: {"intent": "...", "slots": {...}}
            """;

    private final ChatModel chatModel;
    private final ProductSearchTool productSearchTool;
    private final IProductService productService;
    private final ObjectMapper mapper = new ObjectMapper();
    private final NumberFormat currencyFormatter = NumberFormat.getInstance(new Locale("vi", "VN"));

    @Autowired
    public ChatAiController(ObjectProvider<ChatModel> chatModelProvider,
                            ProductSearchTool productSearchTool,
                            IProductService productService) {
        this.chatModel = chatModelProvider.getIfAvailable();
        this.productSearchTool = productSearchTool;
        this.productService = productService;
    }

    @PostMapping("/chat")
    public ResponseEntity<BotChatResponseDTO> handleChat(@Valid @RequestBody ChatRequestDTO request) {
        if (request == null || request.message() == null || request.message().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new BotChatResponseDTO("Nội dung tin nhắn không được để trống.", false, List.of()));
        }

        if (chatModel == null) {
            return ResponseEntity.ok(new BotChatResponseDTO(
                    "Trợ lý AI chưa được kích hoạt trong cấu hình ứng dụng.", false, List.of()));
        }

        try {
            String userMsg = request.message().trim();

            // =========================================================================
            // BƯỚC 1: Gọi mô hình Qwen Ollama cục bộ để trích xuất Intent và Slots (NLU)
            // =========================================================================
            JsonNode nluJson = extractNlu(userMsg);
            String intent = nluJson != null && nluJson.hasNonNull("intent")
                    ? nluJson.get("intent").asText().trim().toUpperCase()
                    : "SEARCH_COMIC";
            JsonNode slots = nluJson != null ? nluJson.path("slots") : null;

            log.info("Qwen NLU Classification -> Intent: {}, Slots: {}", intent, slots);

            // =========================================================================
            // BƯỚC 2: Điều hướng logic nghiệp vụ & sinh câu phản hồi mẫu cho 10 Intent
            // =========================================================================
            List<ProductChatSummaryDTO> products = new ArrayList<>();
            String botReply;

            switch (intent) {
                case "SEARCH_COMIC": {
                    String keyword = textOrNull(slots, "keyword");
                    if (keyword == null || keyword.isBlank()) {
                        keyword = userMsg; // Fallback nếu slots không bóc tách được keyword
                    }
                    ProductSearchRequestAI searchReq = buildSearchRequest(slots, keyword);
                    ProductSearchResponseAI res = productSearchTool.apply(searchReq);
                    products = res.products();

                    if (!products.isEmpty()) {
                        botReply = "ComicWorm tìm thấy " + products.size() + " cuốn truyện phù hợp với từ khóa \""
                                + keyword + "\" của bạn. Dưới đây là danh sách truyện có sẵn:";
                    } else {
                        botReply = "Rất tiếc, ComicWorm hiện chưa tìm thấy cuốn truyện nào khớp với từ khóa \""
                                + keyword + "\". Bạn có thể thử tìm theo tên tác giả, tập truyện khác hoặc tham khảo các truyện nổi bật bên dưới nhé!";
                    }
                    break;
                }

                case "FILTER_PRICE": {
                    ProductSearchRequestAI searchReq = buildSearchRequest(slots, textOrNull(slots, "keyword"));
                    ProductSearchResponseAI res = productSearchTool.apply(searchReq);
                    products = res.products();

                    if (!products.isEmpty()) {
                        Double maxPrice = slots != null && slots.path("maxPrice").isNumber() ? slots.path("maxPrice").asDouble() : null;
                        String priceDesc = maxPrice != null ? "dưới " + formatCurrency(maxPrice) : "yêu cầu";
                        botReply = "Dưới đây là các đầu truyện có mức giá " + priceDesc + " và tình trạng phù hợp với tiêu chí lọc của bạn:";
                    } else {
                        botReply = "Hiện tại không tìm thấy bộ truyện nào phù hợp với khoảng giá hoặc tiêu chí bạn đã lọc. Bạn hãy thử nới rộng khoảng giá hoặc chọn cấp độ tình trạng khác xem sao nhé!";
                    }
                    break;
                }

                case "CHECK_STOCK": {
                    ProductSearchRequestAI searchReq = buildSearchRequest(slots, textOrNull(slots, "keyword"));
                    ProductSearchResponseAI res = productSearchTool.apply(searchReq);
                    products = res.products();

                    if (!products.isEmpty()) {
                        StringBuilder sb = new StringBuilder("Thông tin tồn kho ComicWorm kiểm tra cho bạn:\n\n");
                        for (var p : products) {
                            String vol = (p.volumeNumbers() != null && !p.volumeNumbers().isBlank()) ? p.volumeNumbers() : "Bản lẻ";
                            sb.append("• **").append(p.title()).append("** (Tập: ").append(vol).append(")\n")
                                    .append("   - Tồn kho: **").append(p.stockQuantity()).append(" cuốn**\n")
                                    .append("   - Giá bán: ").append(formatCurrency(p.price()))
                                    .append(" | Tình trạng: ").append(p.conditionPercent()).append("%\n\n");
                        }
                        sb.append("👉 Bạn có thể bấm trực tiếp vào thẻ truyện bên dưới để xem chi tiết và đặt hàng ngay nhé!");
                        botReply = sb.toString();
                    } else {
                        String kw = textOrNull(slots, "keyword");
                        botReply = "Rất tiếc, tựa truyện " + (kw != null ? "\"" + kw + "\" " : "")
                                + "hiện đã hết hàng hoặc chưa có người bán nào đăng tải trên sàn ComicWorm.";
                    }
                    break;
                }

                case "ASK_EDITION": {
                    String edition = textOrNull(slots, "editionType");
                    ProductSearchRequestAI searchReq = buildSearchRequest(slots, textOrNull(slots, "keyword"));
                    ProductSearchResponseAI res = productSearchTool.apply(searchReq);
                    products = res.products();

                    if (!products.isEmpty()) {
                        String edText = edition != null ? "phiên bản " + edition : "các phiên bản đặc biệt/bìa cứng";
                        botReply = "ComicWorm tìm thấy các đầu truyện thuộc " + edText + " phù hợp với yêu cầu của bạn:";
                    } else {
                        botReply = "Hiện tại sàn ComicWorm chưa có phiên bản "
                                + (edition != null ? edition : "đặc biệt") + " cho tựa truyện bạn đang tìm kiếm.";
                    }
                    break;
                }

                case "CHECK_CONDITION": {
                    String keyword = textOrNull(slots, "keyword");
                    if (keyword != null && !keyword.isBlank()) {
                        ProductSearchRequestAI searchReq = buildSearchRequest(slots, keyword);
                        ProductSearchResponseAI res = productSearchTool.apply(searchReq);
                        products = res.products();
                    }

                    StringBuilder sb = new StringBuilder("""
                            📋 **Quy định 4 cấp độ thẩm định tình trạng truyện tại ComicWorm:**

                            ✨ **1. Mới (NEW - 100%):** Sách mới tinh, nguyên màng co (seal) của NXB, chưa từng mở đọc.
                            💎 **2. Like New (LIKE_NEW - 96% đến 99%):** Đọc lướt 1 lần hoặc sưu tầm tủ kính, phẳng phiu, không cấn góc, không ố vàng.
                            📖 **3. Đã đọc (GOOD - 90% đến 95%):** Ruột sách sạch sẽ, gáy chắc chắn, có thể có vết lông mèo nhẹ do bảo quản.
                            📦 **4. Cũ (USED - Dưới 90%):** Sách cũ theo thời gian, có thể ố vàng mép giấy (foxing), gập mép hoặc từng qua thuê mướn.
                            """);

                    if (!products.isEmpty()) {
                        sb.append("\n🔍 **Độ mới thực tế của các truyện liên quan đang có trên sàn:**\n");
                        for (var p : products) {
                            ConditionGrade grade = ConditionGrade.fromPercent(p.conditionPercent());
                            sb.append("• ").append(p.title()).append(": Đạt **")
                                    .append(p.conditionPercent()).append("%** (")
                                    .append(grade.labelFor(p.conditionPercent())).append(")\n");
                        }
                    }
                    botReply = sb.toString();
                    break;
                }

                case "POPULAR_BESTSELLER": {
                    int limit = (slots != null && slots.path("limit").isInt()) ? slots.path("limit").asInt() : 5;
                    List<ProductCardDTO> bestSellers = productService.getBestSellers(Math.min(limit, 10));
                    products = bestSellers.stream().map(this::toChatSummary).toList();

                    if (!products.isEmpty()) {
                        botReply = "🔥 **Top những bộ truyện tranh hot và bán chạy nhất tại ComicWorm hiện nay:**";
                    } else {
                        botReply = "Danh sách truyện bán chạy hiện đang được hệ thống tổng hợp và cập nhật.";
                    }
                    break;
                }

                case "NEWEST_COMIC": {
                    int limit = (slots != null && slots.path("limit").isInt()) ? slots.path("limit").asInt() : 5;
                    List<ProductCardDTO> latest = productService.getLatest(Math.min(limit, 10));
                    products = latest.stream().map(this::toChatSummary).toList();

                    if (!products.isEmpty()) {
                        botReply = "✨ **Đây là các đầu truyện mới nhất vừa cập bến sàn ComicWorm:**";
                    } else {
                        botReply = "Hiện tại chưa có thêm truyện mới cập bến sàn hôm nay.";
                    }
                    break;
                }

                case "POLICY_INQUIRY": {
                    botReply = """
                            📌 **Chính sách mua bán & giao hàng tại ComicWorm:**

                            🚚 **1. Phí vận chuyển:**
                               - Đơn mua thường từ shop: Đồng giá **30.000 VNĐ** / shop.
                               - Đơn phòng trao đổi truyện: **25.000 VNĐ** (Giao tiêu chuẩn) hoặc **40.000 VNĐ** (Giao hỏa tốc).

                            💳 **2. Thanh toán:**
                               - Hỗ trợ thanh toán khi nhận hàng (COD), VietQR, VNPAY, MoMo hoặc Thẻ quốc tế.

                            ⏳ **3. Tự động hoàn tất:**
                               - Đơn hàng sẽ tự động chuyển sang trạng thái COMPLETED sau **7 ngày** kể từ khi giao thành công nếu người mua không gửi khiếu nại.

                            🎁 **4. Tích điểm thưởng (Loyalty):**
                               - Tự động tích lũy **1 điểm thưởng cho mỗi 10.000 VNĐ** giá trị đơn hàng hoàn tất. Điểm có thể dùng để đổi ưu đãi tại trang cá nhân.

                            🛡️ **5. Kiểm duyệt chất lượng:**
                               - 100% truyện đăng bán phải qua kiểm duyệt nội dung của Quản trị viên trước khi hiển thị công khai.
                            """;
                    break;
                }

                case "TRADE_EXCHANGE_INQUIRY": {
                    ProductSearchRequestAI searchReq = new ProductSearchRequestAI(
                            textOrNull(slots, "keyword"),
                            null,
                            null,
                            "TRADE"
                    );
                    ProductSearchResponseAI res = productSearchTool.apply(searchReq);
                    products = res.products();

                    StringBuilder sb = new StringBuilder("""
                            🔄 **Quy trình 5 bước trao đổi truyện C2C an toàn tại ComicWorm (Exchange Room):**

                            1️⃣ **Bước 1:** Khách tham gia phòng trao đổi do chủ truyện (Host) khởi tạo.
                            2️⃣ **Bước 2:** Người tham gia gửi Đề xuất (Offer): chọn sách từ tủ truyện của mình hoặc đề xuất khoản bù tiền mặt.
                            3️⃣ **Bước 3:** Hai bên trao đổi, thương lượng trực tiếp qua khung chat trong phòng.
                            4️⃣ **Bước 4:** Cả hai bên cùng nhấn "Xác nhận chốt thỏa thuận" để khóa giao dịch.
                            5️⃣ **Bước 5:** Hai bên tạo đơn vận chuyển giao nhận truyện bảo hộ qua sàn ComicWorm.
                            """);

                    if (!products.isEmpty()) {
                        sb.append("\n📚 **Một số đầu truyện đang sẵn sàng nhận giao lưu/trao đổi từ cộng đồng:**");
                    } else {
                        sb.append("\nHiện tại chưa có truyện nào mở phòng trao đổi mới. Bạn có thể tự mở phòng trao đổi từ tủ truyện cá nhân của mình nhé!");
                    }
                    botReply = sb.toString();
                    break;
                }

                case "GREETING_CHITCHAT":
                default: {
                    botReply = """
                            👋 **Xin chào bạn! Mình là Trợ lý AI của sàn truyện tranh ComicWorm.** 🐛

                            Mình có thể hỗ trợ bạn các tiện ích sau:
                            🔍 **Tìm kiếm truyện:** Theo tên truyện, tác giả, số tập hoặc phiên bản.
                            💰 **Lọc theo ngân sách:** Tìm truyện theo tầm giá và độ mới mong muốn.
                            📦 **Kiểm tra tồn kho:** Xem số lượng sách thực tế còn trong kho.
                            🔥 **Khám phá:** Xem Top truyện bán chạy nhất hoặc truyện mới lên kệ.
                            🔄 **Trao đổi C2C:** Hướng dẫn quy trình đổi truyện tại Exchange Room.
                            📋 **Giải đáp chính sách:** Phí ship, phương thức thanh toán và tích điểm Loyalty.

                            Hôm nay bạn đang muốn tìm cuốn truyện nào? Hãy nhắn cho mình nhé!
                            """;
                    break;
                }
            }

            return ResponseEntity.ok(new BotChatResponseDTO(botReply, !products.isEmpty(), products));

        } catch (Exception e) {
            log.error("Lỗi xử lý Chatbot Ollama: {}", e.getMessage(), e);
            String root = rootMessage(e);
            String botMsg = "Xin lỗi bạn, hệ thống AI tư vấn hiện đang bận hoặc quá tải. Vui lòng thử lại sau ít phút!";

            // Bắt lỗi mất kết nối máy chủ Ollama cục bộ (Port 11434 connection refused / timeout)
            if (root != null) {
                String lower = root.toLowerCase();
                if (lower.contains("connection refused") || lower.contains("connectexception")
                        || lower.contains("11434") || lower.contains("failed to connect")) {
                    botMsg = "Không thể kết nối đến máy chủ AI Ollama cục bộ (port 11434). "
                            + "Vui lòng kiểm tra tiến trình Ollama đã được khởi chạy với lệnh: 'ollama run " + modelName + "' chưa nhé!";
                } else if (lower.contains("timeout") || lower.contains("timed out")) {
                    botMsg = "Mô hình AI đang bận xử lý và chưa kịp phản hồi. Bạn vui lòng gửi lại tin nhắn nhé!";
                }
            }

            return ResponseEntity.ok(new BotChatResponseDTO(botMsg, false, List.of()));
        }
    }

    // =========================================================================
    // HÀM HỖ TRỢ XỬ LÝ NLU & TRUY VẤN
    // =========================================================================

    private JsonNode extractNlu(String userMsg) {
        try {
            ChatResponse r = callModel(List.of(
                    new SystemMessage(NLU_SYSTEM_PROMPT),
                    new UserMessage(userMsg)
            ));
            if (r == null || r.getResult() == null || r.getResult().getOutput() == null) {
                return null;
            }
            String json = r.getResult().getOutput().getText();
            if (json == null || json.isBlank()) return null;
            json = json.replaceAll("(?s)```json|```", "").trim();
            return mapper.readTree(json);
        } catch (Exception e) {
            log.warn("Không trích xuất được NLU JSON từ Ollama: {}", e.getMessage());
            return null;
        }
    }

    private ChatResponse callModel(List<Message> messages) {
        OpenAiChatOptions options = OpenAiChatOptions.builder()
                .model(modelName)
                .temperature(0.3) // Giảm nhiệt độ để NLU phân loại và trích xuất JSON chuẩn xác
                .build();
        return chatModel.call(new Prompt(messages, options));
    }

    private ProductSearchRequestAI buildSearchRequest(JsonNode slots, String overrideKeyword) {
        String keyword = overrideKeyword != null && !overrideKeyword.isBlank()
                ? overrideKeyword
                : textOrNull(slots, "keyword");

        Double maxPrice = (slots != null && slots.path("maxPrice").isNumber())
                ? slots.path("maxPrice").asDouble()
                : null;

        Integer minCondition = (slots != null && slots.path("minConditionPercent").isNumber())
                ? slots.path("minConditionPercent").asInt()
                : null;

        // Nếu model trả về conditionGrade (NEW, LIKE_NEW...)
        String grade = textOrNull(slots, "conditionGrade");
        if (minCondition == null && grade != null) {
            minCondition = ConditionGrade.parse(grade).map(ConditionGrade::getMin).orElse(null);
        }

        String listingType = textOrNull(slots, "listingType");

        // Gộp thêm thông tin tập truyện hoặc phiên bản vào từ khóa tìm kiếm nếu có
        String edition = textOrNull(slots, "editionType");
        String volume = textOrNull(slots, "volumeNumbers");
        if (edition != null && !edition.isBlank()) {
            keyword = (keyword != null) ? keyword + " " + edition : edition;
        }
        if (volume != null && !volume.isBlank()) {
            keyword = (keyword != null) ? keyword + " " + volume : volume;
        }

        return new ProductSearchRequestAI(keyword, maxPrice, minCondition, listingType);
    }

    private ProductChatSummaryDTO toChatSummary(ProductCardDTO card) {
        return new ProductChatSummaryDTO(
                card.getId(),
                card.getTitle(),
                card.getSlug(),
                card.getPrice(),
                card.getCoverImageUrl(),
                card.getConditionPercent(),
                card.getVolumeNumbers(),
                card.getEditionType(),
                card.getStockQuantity(),
                card.getListingType(),
                card.getAuthorName(),
                card.getCategoryName()
        );
    }

    private String formatCurrency(Number amount) {
        if (amount == null) return "Chưa có giá";
        return currencyFormatter.format(amount) + " đ";
    }

    private static String textOrNull(JsonNode n, String field) {
        if (n == null) return null;
        JsonNode v = n.path(field);
        return (v.isMissingNode() || v.isNull() || v.asText().isBlank()) ? null : v.asText().trim();
    }

    private static String rootMessage(Throwable t) {
        Throwable root = t;
        while (root.getCause() != null) root = root.getCause();
        return root.getMessage();
    }
}