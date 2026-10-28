package com.example.comicworm;

import com.example.comicworm.dto.request.CreateUpgradeRequestDTO;
import com.example.comicworm.dto.response.SellerTierInfoDTO;
import com.example.comicworm.dto.response.SellerUpgradeRequestDTO;
import com.example.comicworm.model.SellerProfile;
import com.example.comicworm.model.SellerUpgradeRequest;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.UpgradeRequestStatus;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.SellerProfileRepository;
import com.example.comicworm.repository.SellerUpgradeRequestRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.impl.SellerTierServiceImpl;
import com.example.comicworm.service.upload.UploadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SellerTierServiceTests {

    private SellerProfileRepository profileRepository = mock(SellerProfileRepository.class);
    private SellerUpgradeRequestRepository requestRepository = mock(SellerUpgradeRequestRepository.class);
    private UserRepository userRepository = mock(UserRepository.class);
    private ProductRepository productRepository = mock(ProductRepository.class);
    private UploadService uploadService = mock(UploadService.class);

    private SellerTierServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new SellerTierServiceImpl(
                profileRepository,
                requestRepository,
                userRepository,
                productRepository,
                uploadService
        );
    }

    private User createTestUser(Long id, boolean isSeller) {
        User u = new User();
        u.setId(id);
        u.setEmail("user" + id + "@example.com");
        u.setFullName("User " + id);
        u.setIsSeller(isSeller);
        when(userRepository.findById(id)).thenReturn(Optional.of(u));
        return u;
    }

    @Test
    void getTierInfo_returnsCorrectInfoForBuyer() {
        Long userId = 10L;
        createTestUser(userId, false);
        when(profileRepository.findByUserId(userId)).thenReturn(Optional.empty());

        SellerTierInfoDTO info = service.getTierInfo(userId);

        assertNotNull(info);
        assertFalse(info.isSeller());
        assertEquals(0, info.getCurrentLevel());
        assertEquals("Khách hàng", info.getCurrentLevelName());
        assertEquals(5, info.getTiers().size());
    }

    @Test
    void getTierInfo_returnsCorrectInfoForSeller() {
        Long userId = 20L;
        createTestUser(userId, true);

        SellerProfile profile = new SellerProfile();
        profile.setUserId(userId);
        profile.setShopName("Manga World");
        profile.setLevel(2);
        when(profileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(productRepository.countBySellerIdAndDeletedAtIsNull(userId)).thenReturn(5L);

        SellerTierInfoDTO info = service.getTierInfo(userId);

        assertNotNull(info);
        assertTrue(info.isSeller());
        assertEquals(2, info.getCurrentLevel());
        assertEquals("Manga World", info.getShopName());
        assertEquals(30, info.getMaxPostLimit());
        assertEquals(4.5, info.getCommissionRate());
    }

    @Test
    void requestUpgrade_createsPendingRequest() {
        Long userId = 10L;
        createTestUser(userId, false);
        when(requestRepository.existsByUserIdAndStatus(userId, UpgradeRequestStatus.PENDING)).thenReturn(false);

        when(requestRepository.save(any(SellerUpgradeRequest.class))).thenAnswer(inv -> {
            SellerUpgradeRequest r = inv.getArgument(0);
            r.setId(999L);
            return r;
        });

        CreateUpgradeRequestDTO req = new CreateUpgradeRequestDTO();
        req.setToLevel(1);
        req.setShopName("Tiệm Truyện Mới");
        req.setPaymentProofUrl("https://example.com/proof.jpg");
        req.setTransactionCode("MB12345");

        SellerUpgradeRequestDTO result = service.requestUpgrade(userId, req);

        assertNotNull(result);
        assertEquals(999L, result.getId());
        assertEquals("PENDING", result.getStatus());
        assertEquals(1, result.getToLevel());
        assertEquals(new BigDecimal("100000"), result.getFeeAmount());
        verify(requestRepository).save(any(SellerUpgradeRequest.class));
    }

    @Test
    void requestUpgrade_fails_whenPendingRequestExists() {
        Long userId = 10L;
        createTestUser(userId, false);
        when(requestRepository.existsByUserIdAndStatus(userId, UpgradeRequestStatus.PENDING)).thenReturn(true);

        CreateUpgradeRequestDTO req = new CreateUpgradeRequestDTO();
        req.setToLevel(1);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.requestUpgrade(userId, req)
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("chờ Admin xét duyệt"));
        verify(requestRepository, never()).save(any());
    }

    @Test
    void requestUpgrade_fails_whenTargetLevelLessOrEqualCurrent() {
        Long userId = 20L;
        createTestUser(userId, true);

        SellerProfile profile = new SellerProfile();
        profile.setLevel(3);
        when(profileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        CreateUpgradeRequestDTO req = new CreateUpgradeRequestDTO();
        req.setToLevel(2); // Cố tình hạ hoặc chọn cấp nhỏ hơn 3

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.requestUpgrade(userId, req)
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("lớn hơn cấp độ hiện tại"));
    }

    @Test
    void approveRequest_activatesSellerAndUpdatesLevel() {
        Long adminId = 1L;
        Long userId = 10L;
        User user = createTestUser(userId, false); // Đang là buyer

        SellerUpgradeRequest req = new SellerUpgradeRequest();
        req.setId(500L);
        req.setUserId(userId);
        req.setFromLevel(0);
        req.setToLevel(1);
        req.setShopName("Comic Pro");
        req.setFeeAmount(new BigDecimal("100000"));
        req.setStatus(UpgradeRequestStatus.PENDING);

        when(requestRepository.findById(500L)).thenReturn(Optional.of(req));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(profileRepository.findByUserId(userId)).thenReturn(Optional.empty());

        SellerUpgradeRequestDTO approved = service.approveRequest(adminId, 500L);

        assertNotNull(approved);
        assertEquals("APPROVED", approved.getStatus());
        assertTrue(user.getIsSeller()); // User được kích hoạt is_seller = true!
        verify(userRepository).save(user);
        verify(profileRepository).save(any(SellerProfile.class));
    }

    @Test
    void rejectRequest_updatesStatusAndReason() {
        Long adminId = 1L;
        SellerUpgradeRequest req = new SellerUpgradeRequest();
        req.setId(500L);
        req.setStatus(UpgradeRequestStatus.PENDING);

        when(requestRepository.findById(500L)).thenReturn(Optional.of(req));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SellerUpgradeRequestDTO rejected = service.rejectRequest(adminId, 500L, "Biên lai mờ không rõ số tiền");

        assertNotNull(rejected);
        assertEquals("REJECTED", rejected.getStatus());
        assertEquals("Biên lai mờ không rõ số tiền", rejected.getRejectionReason());
        verify(requestRepository).save(req);
    }
}

