package com.example.comicworm;

import com.example.comicworm.controller.SellerReviewController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.ReviewReplyRequest;
import com.example.comicworm.model.User;
import com.example.comicworm.service.ReviewReplyService;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SellerReviewControllerTests {

    @Test
    void mapsConcurrentUniqueConstraintViolationToConflict() {
        ReviewReplyService service = mock(ReviewReplyService.class);
        when(service.create(5L, 30L, "Phản hồi"))
                .thenThrow(new DataIntegrityViolationException("duplicate review reply"));
        SellerReviewController controller = new SellerReviewController(service);

        User seller = new User();
        seller.setId(5L);
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> controller.create(30L, new ReviewReplyRequest("Phản hồi"),
                        new CustomUserDetails(seller)));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }
}
