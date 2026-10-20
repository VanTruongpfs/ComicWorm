package com.example.comicworm;

import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.repository.*;
import com.example.comicworm.service.admin.AdminModerationService;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminModerationServiceTests {
    ProductRepository products = mock(ProductRepository.class);
    AdminModerationService service;

    @BeforeEach void setUp() {
        service = new AdminModerationService(products, mock(ProductImageRepository.class), mock(UserRepository.class),
                mock(CategoryRepository.class), mock(AuthorRepository.class), mock(PublisherRepository.class));
    }

    Product pending(long id) {
        var product = new Product();
        product.setId(id); product.setSellerId(9L); product.setTitle("One Piece 105");
        product.setCategoryId(1); product.setModerationStatus(ModerationStatus.PENDING);
        when(products.lockForModeration(id)).thenReturn(Optional.of(product));
        return product;
    }

    @Test void approveMarksApprovedAndRecordsTheAdmin() {
        Product product = pending(5);
        product.setModerationReason("old reason");
        service.approve(1L, 5L);
        assertEquals(ModerationStatus.APPROVED, product.getModerationStatus());
        assertEquals(1L, product.getModeratedBy());
        assertNotNull(product.getModeratedAt());
        assertNull(product.getModerationReason());
        verify(products).saveAndFlush(product);
    }

    @Test void rejectStoresTrimmedReasonAndRecordsTheAdmin() {
        Product product = pending(5);
        service.reject(1L, 5L, "  Anh khong dung san pham  ");
        assertEquals(ModerationStatus.REJECTED, product.getModerationStatus());
        assertEquals("Anh khong dung san pham", product.getModerationReason());
        assertEquals(1L, product.getModeratedBy());
        assertNotNull(product.getModeratedAt());
    }

    @Test void rejectWithoutAReasonChangesNothing() {
        Product product = pending(5);
        for (String reason : new String[]{null, "", "   ", "abc"}) {
            assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.reject(1L, 5L, reason))
                    .getStatusCode().value());
        }
        assertEquals(ModerationStatus.PENDING, product.getModerationStatus());
        verify(products, never()).saveAndFlush(any());
    }

    @Test void alreadyModeratedOrMissingPostsAreRejectedWithConflictOrNotFound() {
        Product done = pending(6);
        done.setModerationStatus(ModerationStatus.APPROVED);
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.approve(1L, 6L)).getStatusCode().value());
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.reject(1L, 6L, "Khong hop le")).getStatusCode().value());
        when(products.lockForModeration(7L)).thenReturn(Optional.empty());
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.approve(1L, 7L)).getStatusCode().value());
    }

    @Test void listRejectsBadPaging() {
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.list(ModerationStatus.PENDING, "", 0, 1000)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.list(ModerationStatus.PENDING, "", -1, 10)).getStatusCode().value());
    }
}
