package com.example.comicworm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.comicworm.dto.request.SellerApplicationForm;
import com.example.comicworm.model.SellerApplication;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.SellerApplicationStatus;
import com.example.comicworm.repository.SellerApplicationRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.account.SellerApplicationService;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class SellerApplicationServiceTests {
    private final SellerApplicationRepository applications = mock(SellerApplicationRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private SellerApplicationService service;
    private User buyer;

    @BeforeEach
    void setUp() {
        service = new SellerApplicationService(applications, users);
        buyer = user(7L);
        when(users.lockById(7L)).thenReturn(Optional.of(buyer));
        when(users.findById(7L)).thenReturn(Optional.of(buyer));
        when(applications.save(any(SellerApplication.class))).thenAnswer(i -> i.getArgument(0));
    }

    private static User user(Long id) {
        User u = new User();
        u.setId(id);
        u.setEmail("buyer@comicworm.test");
        u.setFullName("Người Mua");
        u.setIsSeller(false);
        u.setAccountStatus(AccountStatus.ACTIVE);
        return u;
    }

    private static SellerApplicationForm form(LocalDate born, LocalDate issued) {
        return new SellerApplicationForm("001099012345", "NGUYỄN VĂN MẪU", born, issued,
                "Cục Cảnh sát quản lý hành chính về trật tự xã hội");
    }

    private static HttpStatus statusOf(Throwable t) {
        return HttpStatus.valueOf(((ResponseStatusException) t).getStatusCode().value());
    }

    private SellerApplication pending(Long id) {
        SellerApplication a = new SellerApplication();
        a.setId(id);
        a.setUserId(7L);
        a.setStatus(SellerApplicationStatus.PENDING);
        a.setIdNumber("001099012345");
        a.setIdFullName("NGUYỄN VĂN MẪU");
        a.setIdDateOfBirth(LocalDate.of(1999, 1, 1));
        a.setIdIssueDate(LocalDate.of(2021, 6, 15));
        a.setIdIssuePlace("Cục Cảnh sát");
        when(applications.lockById(id)).thenReturn(Optional.of(a));
        when(applications.findById(id)).thenReturn(Optional.of(a));
        return a;
    }

    @Test
    void submitCreatesPendingApplicationWithTrimmedFields() {
        var input = new SellerApplicationForm(" 001099012345 ", "  NGUYỄN VĂN MẪU ", LocalDate.of(1999, 1, 1),
                LocalDate.of(2021, 6, 15), "  Cục Cảnh sát  ");

        var dto = service.submit(7L, input);

        ArgumentCaptor<SellerApplication> saved = ArgumentCaptor.forClass(SellerApplication.class);
        verify(applications).save(saved.capture());
        assertThat(saved.getValue().getUserId()).isEqualTo(7L);
        assertThat(saved.getValue().getStatus()).isEqualTo(SellerApplicationStatus.PENDING);
        assertThat(saved.getValue().getIdNumber()).isEqualTo("001099012345");
        assertThat(saved.getValue().getIdFullName()).isEqualTo("NGUYỄN VĂN MẪU");
        assertThat(saved.getValue().getIdIssuePlace()).isEqualTo("Cục Cảnh sát");
        assertThat(dto.status()).isEqualTo("PENDING");
        assertThat(dto.userEmail()).isEqualTo("buyer@comicworm.test");
    }

    @Test
    void submitLocksTheUserRowBeforeCheckingPending() {
        when(applications.existsByUserIdAndStatus(7L, SellerApplicationStatus.PENDING)).thenReturn(true);

        assertThatThrownBy(() -> service.submit(7L, SellerApplicationForm.sample()))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));

        var order = inOrder(users, applications);
        order.verify(users).lockById(7L);
        order.verify(applications).existsByUserIdAndStatus(7L, SellerApplicationStatus.PENDING);
        verify(applications, never()).save(any());
    }

    @Test
    void submitRejectsSellersLockedAndDeletedUsers() {
        buyer.setIsSeller(true);
        assertThatThrownBy(() -> service.submit(7L, SellerApplicationForm.sample()))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));

        buyer.setIsSeller(false);
        buyer.setAccountStatus(AccountStatus.LOCKED);
        assertThatThrownBy(() -> service.submit(7L, SellerApplicationForm.sample()))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));

        when(users.lockById(7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.submit(7L, SellerApplicationForm.sample()))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.UNAUTHORIZED));

        assertThatThrownBy(() -> service.submit(null, SellerApplicationForm.sample()))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.UNAUTHORIZED));
        verify(applications, never()).save(any());
    }

    @Test
    void submitValidatesDates() {
        LocalDate today = LocalDate.now();
        assertThatThrownBy(() -> service.submit(7L, form(today.minusYears(17), today.minusDays(1))))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("18 tuổi");
        assertThatThrownBy(() -> service.submit(7L, form(LocalDate.of(1999, 1, 1), today.plusDays(1))))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> service.submit(7L, form(LocalDate.of(1999, 1, 1), LocalDate.of(1998, 12, 31))))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> service.submit(7L, form(LocalDate.of(1899, 12, 31), LocalDate.of(2021, 6, 15))))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(applications, never()).save(any());
    }

    @Test
    void approveTurnsOnSellerAndRecordsReviewer() {
        var application = pending(5L);

        var dto = service.approve(1L, 5L);

        assertThat(application.getStatus()).isEqualTo(SellerApplicationStatus.APPROVED);
        assertThat(application.getReviewedBy()).isEqualTo(1L);
        assertThat(application.getReviewedAt()).isNotNull();
        assertThat(buyer.getIsSeller()).isTrue();
        assertThat(dto.status()).isEqualTo("APPROVED");
    }

    @Test
    void approveRejectsLockedOrDeletedUser() {
        pending(5L);
        buyer.setAccountStatus(AccountStatus.LOCKED);
        assertThatThrownBy(() -> service.approve(1L, 5L))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));
        assertThat(buyer.getIsSeller()).isFalse();

        when(users.lockById(7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.approve(1L, 5L))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void approveOrRejectNonPendingConflicts() {
        pending(5L).setStatus(SellerApplicationStatus.APPROVED);

        assertThatThrownBy(() -> service.approve(1L, 5L))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));
        assertThatThrownBy(() -> service.reject(1L, 5L, "Ảnh mờ"))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void rejectRequiresReasonAndStoresIt() {
        var application = pending(5L);

        assertThatThrownBy(() -> service.reject(1L, 5L, "   "))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> service.reject(1L, 5L, "x".repeat(501)))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThat(application.getStatus()).isEqualTo(SellerApplicationStatus.PENDING);

        service.reject(1L, 5L, "  Ảnh mờ  ");

        assertThat(application.getStatus()).isEqualTo(SellerApplicationStatus.REJECTED);
        assertThat(application.getReviewNote()).isEqualTo("Ảnh mờ");
        assertThat(application.getReviewedBy()).isEqualTo(1L);
        assertThat(buyer.getIsSeller()).isFalse();
    }

    @Test
    void resubmitAfterRejectionCreatesNewRow() {
        var previous = pending(5L);
        previous.setStatus(SellerApplicationStatus.REJECTED);
        when(applications.existsByUserIdAndStatus(7L, SellerApplicationStatus.PENDING)).thenReturn(false);

        service.submit(7L, SellerApplicationForm.sample());

        ArgumentCaptor<SellerApplication> saved = ArgumentCaptor.forClass(SellerApplication.class);
        verify(applications).save(saved.capture());
        assertThat(saved.getValue()).isNotSameAs(previous);
        assertThat(saved.getValue().getId()).isNull();
        assertThat(previous.getStatus()).isEqualTo(SellerApplicationStatus.REJECTED);
    }

    @Test
    void missingApplicationIs404() {
        when(applications.findById(99L)).thenReturn(Optional.empty());
        when(applications.lockById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(99L))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> service.approve(1L, 99L))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> service.reject(1L, 99L, "Ảnh mờ"))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
