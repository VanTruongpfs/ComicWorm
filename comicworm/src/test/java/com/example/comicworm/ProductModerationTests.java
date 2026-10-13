package com.example.comicworm;

import com.example.comicworm.dto.request.RejectProductRequest;
import com.example.comicworm.dto.response.AdminProductRecord;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.ProductImageRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.service.admin.impl.ProductModerationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ProductModerationTests {

    private ProductRepository productRepository;
    private ProductImageRepository productImageRepository;
    private ProductModerationServiceImpl moderationService;

    @BeforeEach
    void setUp() {
        productRepository = mock(ProductRepository.class);
        productImageRepository = mock(ProductImageRepository.class);
        moderationService = new ProductModerationServiceImpl(productRepository, productImageRepository);
    }

    private Product createSampleProduct(Long id, ModerationStatus status) {
        Product p = new Product();
        p.setId(id);
        p.setSellerId(10L);
        p.setTitle("Doraemon Tap 1");
        p.setSlug("doraemon-tap-1");
        p.setDescription("Truyen dep 99%");
        p.setCategoryId(1);
        p.setConditionPercent(99);
        p.setPrice(new BigDecimal("25000.00"));
        p.setStockQuantity(5);
        p.setIsActive(true);
        p.setModerationStatus(status);
        p.setCreatedAt(LocalDateTime.now());
        p.setUpdatedAt(LocalDateTime.now());

        User seller = new User();
        seller.setId(10L);
        seller.setFullName("Nguyen Van Seller");
        seller.setEmail("seller@example.com");
        seller.setRole(UserRole.USER);
        // Note: seller association is read-only in JPA, but record builder handles null safely
        return p;
    }

    @Test
    void testApproveProduct_Success() {
        Product p = createSampleProduct(1L, ModerationStatus.PENDING);
        when(productRepository.findById(1L)).thenReturn(Optional.of(p));
        when(productRepository.saveAndFlush(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(productImageRepository.findByProductIdOrderByDisplayOrderAscIdAsc(1L)).thenReturn(Collections.emptyList());

        AdminProductRecord record = moderationService.approve(1L, 999L);

        assertNotNull(record);
        assertEquals(1L, record.id());
        assertEquals(ModerationStatus.APPROVED, record.moderationStatus());
        assertNull(record.moderationReason());
        assertEquals(999L, record.moderatedBy());
        assertNotNull(record.moderatedAt());

        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).saveAndFlush(captor.capture());
        Product saved = captor.getValue();
        assertEquals(ModerationStatus.APPROVED, saved.getModerationStatus());
        assertNull(saved.getModerationReason());
        assertEquals(999L, saved.getModeratedBy());
        assertNotNull(saved.getModeratedAt());
    }

    @Test
    void testRejectProduct_Success() {
        Product p = createSampleProduct(2L, ModerationStatus.PENDING);
        when(productRepository.findById(2L)).thenReturn(Optional.of(p));
        when(productRepository.saveAndFlush(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(productImageRepository.findByProductIdOrderByDisplayOrderAscIdAsc(2L)).thenReturn(Collections.emptyList());

        String reason = "Ảnh chụp bìa sách không rõ nét, vui lòng chụp lại góc nghiêng.";
        AdminProductRecord record = moderationService.reject(2L, 888L, reason);

        assertNotNull(record);
        assertEquals(2L, record.id());
        assertEquals(ModerationStatus.REJECTED, record.moderationStatus());
        assertEquals(reason, record.moderationReason());
        assertEquals(888L, record.moderatedBy());
        assertNotNull(record.moderatedAt());

        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).saveAndFlush(captor.capture());
        Product saved = captor.getValue();
        assertEquals(ModerationStatus.REJECTED, saved.getModerationStatus());
        assertEquals(reason, saved.getModerationReason());
        assertEquals(888L, saved.getModeratedBy());
    }

    @Test
    void testRejectProduct_EmptyReason_ThrowsException() {
        assertThrows(ResponseStatusException.class, () -> moderationService.reject(1L, 999L, ""));
        assertThrows(ResponseStatusException.class, () -> moderationService.reject(1L, 999L, "   "));
        assertThrows(ResponseStatusException.class, () -> moderationService.reject(1L, 999L, null));
        verify(productRepository, never()).saveAndFlush(any());
    }

    @Test
    void testApproveOrReject_NotFound_ThrowsException() {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> moderationService.approve(999L, 1L));
        assertThrows(ResponseStatusException.class, () -> moderationService.reject(999L, 1L, "Lý do"));
    }

    @Test
    void testListPendingProducts() {
        Product p1 = createSampleProduct(1L, ModerationStatus.PENDING);
        Product p2 = createSampleProduct(2L, ModerationStatus.PENDING);
        Page<Product> page = new PageImpl<>(List.of(p1, p2));

        when(productRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(page);
        when(productRepository.countByModerationStatusAndDeletedAtIsNull(ModerationStatus.PENDING)).thenReturn(2L);
        when(productRepository.countByModerationStatusAndDeletedAtIsNull(ModerationStatus.APPROVED)).thenReturn(10L);
        when(productRepository.countByModerationStatusAndDeletedAtIsNull(ModerationStatus.REJECTED)).thenReturn(1L);

        Map<String, Object> result = moderationService.list(ModerationStatus.PENDING, "", 0, 10);

        assertEquals("OK", result.get("Result"));
        assertEquals(2L, result.get("TotalRecordCount"));
        List<?> records = (List<?>) result.get("Records");
        assertEquals(2, records.size());

        Map<?, ?> stats = (Map<?, ?>) result.get("Stats");
        assertEquals(2L, stats.get("pending"));
        assertEquals(10L, stats.get("approved"));
        assertEquals(1L, stats.get("rejected"));
    }

    @Test
    void testCountStats() {
        when(productRepository.countByModerationStatusAndDeletedAtIsNull(ModerationStatus.PENDING)).thenReturn(5L);
        when(productRepository.countByModerationStatusAndDeletedAtIsNull(ModerationStatus.APPROVED)).thenReturn(15L);
        when(productRepository.countByModerationStatusAndDeletedAtIsNull(ModerationStatus.REJECTED)).thenReturn(3L);

        Map<String, Long> stats = moderationService.countStats();
        assertEquals(5L, stats.get("pending"));
        assertEquals(15L, stats.get("approved"));
        assertEquals(3L, stats.get("rejected"));
    }
}
