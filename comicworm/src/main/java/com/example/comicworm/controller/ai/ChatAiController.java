package com.example.comicworm.controller.ai;

import com.example.comicworm.dto.request.ai.ChatRequestDTO;
import com.example.comicworm.dto.request.ai.ProductSearchRequestAI;
import com.example.comicworm.dto.response.ai.BotChatResponseDTO;
import com.example.comicworm.dto.response.ai.ProductChatSummaryDTO;
import com.example.comicworm.dto.response.ai.ProductSearchResponseAI;
import com.example.comicworm.service.ai.ProductSearchTool;
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
import org.springframework.ai.google.genai.GoogleGenAiChatOptions;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ChatAiController {

    private static final Logger log = LoggerFactory.getLogger(ChatAiController.class);

    private static final List<String> MODELS = List.of(
            "gemini-3.8-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.7-flash",
            "gemini-flash-lite-latest");

    private static final String EXTRACT_PROMPT = """
            Trích bộ lọc tìm truyện từ câu của khách. CHỈ trả về JSON thuần, không giải thích, không markdown:
            {"needSearch":true|false,"keyword":string|null,"maxPrice":number|null,
             "minConditionPercent":number|null,"listingType":string|null}
            Quy tắc:
            - needSearch=true nếu khách muốn tìm, hỏi mua hoặc hỏi truyện theo tên/tác giả/thể loại.
            - keyword là từ khóa ngắn có ý nghĩa (tên truyện, tác giả, thể loại), không chép nguyên câu hỏi.
            - Chỉ điền giá trị khách thực sự nhắc đến, còn lại để null. Không tự bịa giá.
            """;

    private static final String SYSTEM_INSTRUCTION = """
            Bạn là trợ lý ảo tư vấn thông minh của sàn giao dịch truyện tranh ComicWorm (ComicHub).
            Hãy trả lời nhiệt tình, thân thiện, ngắn gọn và am hiểu về truyện tranh (Manga, Comic, Light Novel, Manhwa).

            QUY TẮC KHI TƯ VẤN SẢN PHẨM:
            1. Chỉ giới thiệu các truyện có trong "Danh sách truyện của cửa hàng" được cung cấp. Không bịa thêm truyện, giá hay thông tin.
            2. Khi có kết quả, nêu tên truyện, giá, tình trạng và số lượng từ dữ liệu được cung cấp; không suy đoán thông tin còn thiếu.
            3. Nếu không có kết quả, nói rõ cửa hàng chưa có và hỏi khách muốn thử từ khóa khác.
            4. Nếu khách chỉ trò chuyện, hãy trả lời bình thường về thế giới truyện tranh.
            """;

    private final ChatModel chatModel; // null khi chua cau hinh API key
    private final ProductSearchTool productSearchTool;
    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    public ChatAiController(ObjectProvider<ChatModel> chatModelProvider, ProductSearchTool productSearchTool) {
        this.chatModel = chatModelProvider.getIfAvailable();
        this.productSearchTool = productSearchTool;
    }

    @PostMapping("/chat")
    public ResponseEntity<BotChatResponseDTO> handleChat(@Valid @RequestBody ChatRequestDTO request) {
        if (request == null || request.message() == null || request.message().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new BotChatResponseDTO("Nội dung tin nhắn không được để trống.", false, List.of()));
        }

        if (chatModel == null) {
            return ResponseEntity.ok(new BotChatResponseDTO(
                    "Trợ lý AI chưa được cấu hình API key nên tạm thời chưa hoạt động.", false, List.of()));
        }

        try {
            String userMsg = request.message().trim();

            // Bước 1: nhờ model trích bộ lọc (không dùng tool)
            List<ProductChatSummaryDTO> products = List.of();
            JsonNode filter = extractFilter(userMsg);

            // Bước 2: tự chạy tìm kiếm trong DB
            if (filter != null && filter.path("needSearch").asBoolean(false)) {
                ProductSearchRequestAI searchReq = new ProductSearchRequestAI(
                        textOrNull(filter, "keyword"),
                        filter.path("maxPrice").isNumber() ? filter.path("maxPrice").asDouble() : null,
                        filter.path("minConditionPercent").isNumber() ? filter.path("minConditionPercent").asInt() : null,
                        textOrNull(filter, "listingType"));
                ProductSearchResponseAI res = productSearchTool.apply(searchReq);
                products = res.products();
            }

            // Bước 3: nhờ model viết câu trả lời dựa trên kết quả thật
            String context = products.isEmpty()
                    ? "Không tìm thấy truyện phù hợp trong cửa hàng."
                    : "Danh sách truyện của cửa hàng: " + mapper.writeValueAsString(products);

            ChatResponse answer = callWithFallback(List.of(
                    new SystemMessage(SYSTEM_INSTRUCTION),
                    new UserMessage("Khách hỏi: " + userMsg + "\n\n" + context)));

            String reply = answer.getResult() != null ? answer.getResult().getOutput().getText() : null;
            if (reply == null || reply.isBlank()) {
                reply = "Mình chưa có câu trả lời phù hợp, bạn thử hỏi cụ thể hơn nhé!";
            }

            return ResponseEntity.ok(new BotChatResponseDTO(reply, !products.isEmpty(), products));

        } catch (Exception e) {
            log.error("Chat lỗi: {}", e.getMessage(), e);
            String root = rootMessage(e);
            String botMsg = "Xin lỗi, hệ thống AI hiện đang bận hoặc chưa thể kết nối. Bạn vui lòng thử lại sau!";
            if (root != null && (root.contains("denied access") || root.contains("403"))) {
                botMsg = "Lỗi kết nối Gemini API: Google đã chặn quyền truy cập của Project này (403: Your project has been denied access). Bạn vui lòng truy cập Google AI Studio để tạo API Key mới từ một Project khác nhé!";
            } else if (root != null && (root.contains("API_KEY_INVALID") || root.contains("401"))) {
                botMsg = "API Key Gemini chưa chính xác hoặc đã hết hạn. Vui lòng cập nhật lại key trong application-local.properties!";
            }
            return ResponseEntity.ok(new BotChatResponseDTO(botMsg, false, List.of()));
        }
    }

    /** Trả về null nếu model không trả JSON hợp lệ (khi đó coi như không cần tìm kiếm). */
    private JsonNode extractFilter(String userMsg) {
        try {
            ChatResponse r = callWithFallback(List.of(
                    new SystemMessage(EXTRACT_PROMPT), new UserMessage(userMsg)));
            String json = r.getResult().getOutput().getText();
            json = json.replaceAll("(?s)```json|```", "").trim();
            return mapper.readTree(json);
        } catch (Exception e) {
            log.warn("Không trích được bộ lọc: {}", e.getMessage());
            return null;
        }
    }

    private static String textOrNull(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return (v.isMissingNode() || v.isNull() || v.asText().isBlank()) ? null : v.asText().trim();
    }

    private ChatResponse callWithFallback(List<Message> messages) {
        RuntimeException lastError = null;
        for (String model : MODELS) {
            try {
                GoogleGenAiChatOptions options = GoogleGenAiChatOptions.builder()
                        .model(model)
                        .build();
                ChatResponse response = chatModel.call(new Prompt(messages, options));
                log.info("Đã trả lời bằng model: {}", model);
                return response;
            } catch (RuntimeException e) {
                log.warn("Model {} lỗi: {}", model, rootMessage(e));
                lastError = e;
            }
        }
        throw lastError != null ? lastError : new IllegalStateException("Không có model nào được cấu hình");
    }

    private static String rootMessage(Throwable t) {
        Throwable root = t;
        while (root.getCause() != null) root = root.getCause();
        return root.getMessage();
    }
}