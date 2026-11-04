package com.example.comicworm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.comicworm.controller.ai.ChatAiController;
import com.example.comicworm.dto.request.ai.ChatRequestDTO;
import com.example.comicworm.dto.response.ai.BotChatResponseDTO;
import com.example.comicworm.service.ai.ProductSearchTool;
import com.example.comicworm.service.product.IProductService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.ObjectProvider;

class ChatAiControllerTests {

    private final ChatModel chatModel = mock(ChatModel.class);
    private final IProductService productService = mock(IProductService.class);

    private ChatAiController controller() {
        @SuppressWarnings("unchecked")
        ObjectProvider<ChatModel> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(chatModel);
        return new ChatAiController(provider, mock(ProductSearchTool.class), productService);
    }

    private void modelAnswers(String json) {
        when(chatModel.call(any(Prompt.class)))
                .thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage(json)))));
    }

    private String reply(String message) {
        BotChatResponseDTO body = controller().handleChat(new ChatRequestDTO(message)).getBody();
        assertThat(body).isNotNull();
        return body.botReply();
    }

    @Test
    void numericPolicyIntentIsAnsweredWithPolicy() {
        modelAnswers("{\"intent\": 8, \"slots\": {}}");

        assertThat(reply("phí ship bao nhiêu")).contains("Chính sách mua bán").doesNotContain("Xin chào");
    }

    @Test
    void numericBestsellerIntentLoadsBestSellers() {
        modelAnswers("{\"intent\": \"7\", \"slots\": {}}");
        when(productService.getBestSellers(anyInt())).thenReturn(List.of());

        assertThat(reply("truyện nào đang bán chạy")).contains("bán chạy").doesNotContain("Xin chào");
    }

    @Test
    void namedIntentStillWorks() {
        modelAnswers("{\"intent\": \"POLICY_INQUIRY\", \"slots\": {}}");

        assertThat(reply("đổi trả thế nào")).contains("Chính sách mua bán");
    }

    @Test
    void outOfRangeNumberFallsBackToGreeting() {
        modelAnswers("{\"intent\": 42, \"slots\": {}}");

        assertThat(reply("abc")).contains("Xin chào");
    }

    @Test
    void nluPromptDoesNotNumberIntents() {
        modelAnswers("{\"intent\": \"GREETING_CHITCHAT\", \"slots\": {}}");
        reply("xin chào");

        ArgumentCaptor<Prompt> prompt = ArgumentCaptor.forClass(Prompt.class);
        org.mockito.Mockito.verify(chatModel).call(prompt.capture());
        String system = prompt.getValue().getInstructions().get(0).getText();
        assertThat(system).contains("- POLICY_INQUIRY:").doesNotContainPattern("(?m)^\\s*\\d+\\. [A-Z_]+:");
    }
}
