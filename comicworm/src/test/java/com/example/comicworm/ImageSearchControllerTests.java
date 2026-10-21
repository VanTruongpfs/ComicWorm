package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.admin.AdminImageSearchController;
import com.example.comicworm.controller.product.ProductImageSearchController;
import com.example.comicworm.dto.response.ImageSearchResponse;
import com.example.comicworm.repository.ProductImageFeatureRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.imagesearch.*;
import com.example.comicworm.utils.JwtUtils;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({ProductImageSearchController.class, AdminImageSearchController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class ImageSearchControllerTests {
    @Autowired MockMvc mvc;
    @MockitoBean ProductImageSearchService search;
    @MockitoBean ImageFeatureIndexer indexer;
    @MockitoBean ImageSearchProperties properties;
    @MockitoBean ProductImageFeatureRepository features;
    @MockitoBean UserRepository users;
    @MockitoBean UserDetailsService userDetails;
    @MockitoBean JwtUtils jwt;
    private final MockMultipartFile image = new MockMultipartFile("image", "query.png", "image/png", new byte[]{1});

    @Test void guestCanSearchWithoutLoginOrCsrf() throws Exception {
        when(search.search(any(), eq(24), eq(.5))).thenReturn(new ImageSearchResponse("model", 2, List.of()));
        mvc.perform(multipart("/api/products/image-search").file(image))
                .andExpect(status().isOk()).andExpect(jsonPath("comparedImages").value(2));
    }

    @Test void serviceErrorsRemainReadableAndMissingFileIsRejected() throws Exception {
        when(search.search(any(), anyInt(), anyDouble())).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Chưa sẵn sàng"));
        mvc.perform(multipart("/api/products/image-search").file(image))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("message").value("Chưa sẵn sàng"));
        mvc.perform(multipart("/api/products/image-search")).andExpect(status().isBadRequest());
    }

    @Test void onlyAdminCanIndexAndMutationRequiresCsrf() throws Exception {
        mvc.perform(get("/api/admin/image-search/status")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/image-search/index").with(user("seller").roles("SELLER")).with(csrf()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/image-search/index").with(user("admin").roles("ADMIN")))
                .andExpect(status().isForbidden());
        when(indexer.indexNextBatch()).thenReturn(new ImageFeatureIndexer.BatchResult(2, 2, 0, false));
        mvc.perform(post("/api/admin/image-search/index").with(user("admin").roles("ADMIN")).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("indexed").value(2));
        verify(indexer, times(1)).indexNextBatch();
    }
}
