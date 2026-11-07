package com.example.comicworm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.comicworm.controller.ai.ChatAiController;
import com.example.comicworm.dto.request.ai.ChatRequestDTO;
import com.example.comicworm.dto.request.ai.ProductSearchRequestAI;
import com.example.comicworm.dto.response.ai.BotChatResponseDTO;
import com.example.comicworm.dto.response.ai.ProductSearchResponseAI;
import com.example.comicworm.service.ai.ProductSearchTool;
import com.example.comicworm.service.product.IProductService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
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
    private final ProductSearchTool productSearchTool = mock(ProductSearchTool.class);

    private ChatAiController controller() {
        @SuppressWarnings("unchecked")
        ObjectProvider<ChatModel> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(chatModel);
        return new ChatAiController(provider, productSearchTool, productService);
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

    @Test
    void genericNluKeywordUsesOnePieceFromOriginalMessage() {
        modelAnswers("{\"intent\":\"SEARCH_COMIC\",\"slots\":{\"keyword\":\"comic\"}}");
        when(productSearchTool.apply(any(ProductSearchRequestAI.class)))
                .thenReturn(new ProductSearchResponseAI(List.of()));

        controller().handleChat(new ChatRequestDTO("tôi muốn tìm one bi"));

        ArgumentCaptor<ProductSearchRequestAI> request = ArgumentCaptor.forClass(ProductSearchRequestAI.class);
        org.mockito.Mockito.verify(productSearchTool).apply(request.capture());
        assertThat(request.getValue().keyword()).isEqualTo("One Piece");
    }

    @Test
    void explicitHardcoverPhraseIsSeparatedFromTitleSearch() {
        modelAnswers("{\"intent\":\"SEARCH_COMIC\",\"slots\":{\"keyword\":\"comic\"}}");
        when(productSearchTool.apply(any(ProductSearchRequestAI.class)))
                .thenReturn(new ProductSearchResponseAI(List.of()));

        controller().handleChat(new ChatRequestDTO("tôi muốn tìm one bi bìa cứng"));

        ArgumentCaptor<ProductSearchRequestAI> request = ArgumentCaptor.forClass(ProductSearchRequestAI.class);
        org.mockito.Mockito.verify(productSearchTool).apply(request.capture());
        assertThat(request.getValue().keyword()).isEqualTo("One Piece");
        assertThat(request.getValue().editionType()).isEqualTo("bìa cứng");
    }

    @Test
    void productSearchFiltersEditionOnEditionTypeField() {
        EntityManager entityManager = mock(EntityManager.class);
        Query query = mock(Query.class);
        when(entityManager.createQuery(any(String.class))).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of());

        new ProductSearchTool(entityManager).apply(
                new ProductSearchRequestAI("One Piece", null, null, null, "bìa cứng"));

        ArgumentCaptor<String> jpql = ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(entityManager).createQuery(jpql.capture());
        assertThat(jpql.getValue()).contains("LOWER(p.editionType) LIKE LOWER(:editionType)");
        org.mockito.Mockito.verify(query).setParameter("editionType", "%bìa cứng%");
    }
}
