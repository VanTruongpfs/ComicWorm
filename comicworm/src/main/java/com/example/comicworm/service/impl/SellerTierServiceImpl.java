package com.example.comicworm.service.impl;

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
import com.example.comicworm.service.ISellerTierService;
import com.example.comicworm.service.upload.UploadService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SellerTierServiceImpl implements ISellerTierService {

    private static final Logger log = LoggerFactory.getLogger(SellerTierServiceImpl.class);

    private final SellerProfileRepository profileRepository;
    private final SellerUpgradeRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final UploadService uploadService;

    public static final Map<Integer, BigDecimal> TIER_FEES = Map.of(
            1, new BigDecimal("100000"),
            2, new BigDecimal("200000"),
            3, new BigDecimal("500000"),
            4, new BigDecimal("1000000"),
            5, new BigDecimal("2500000")
    );

    private static final List<SellerTierInfoDTO.TierDetail> TIERS_CONFIG = List.of(
            SellerTierInfoDTO.TierDetail.builder()
                    .level(1).name("Tập sự (Cấp 1)").badgeTitle("Novice Seller").badgeColor("#718096")
                    .fee(TIER_FEES.get(1)).postLimit(10).commissionRate(5.0)
                    .dailyWithdrawLimit("2.000.000₫/ngày").withdrawSpeed("Duyệt trong 48h")
                    .benefits(List.of("Đăng tối đa 10 truyện", "Phí sàn 5.0%", "Rút tiền tối đa 2.000.000₫/ngày"))
                    .build(),
            SellerTierInfoDTO.TierDetail.builder()
                    .level(2).name("Người bán Đồng (Cấp 2)").badgeTitle("Bronze Seller").badgeColor("#cd7f32")
                    .fee(TIER_FEES.get(2)).postLimit(30).commissionRate(4.5)
                    .dailyWithdrawLimit("5.000.000₫/ngày").withdrawSpeed("Duyệt trong 24h")
                    .benefits(List.of("Đăng tối đa 30 truyện", "Phí sàn giảm còn 4.5%", "Rút tiền tối đa 5.000.000₫/ngày"))
                    .build(),
            SellerTierInfoDTO.TierDetail.builder()
                    .level(3).name("Người bán Bạc (Cấp 3)").badgeTitle("Silver Seller").badgeColor("#a0aec0")
                    .fee(TIER_FEES.get(3)).postLimit(100).commissionRate(4.0)
                    .dailyWithdrawLimit("20.000.000₫/ngày").withdrawSpeed("Duyệt trong 12h")
                    .benefits(List.of("Đăng tối đa 100 truyện", "Tạo Voucher Shop riêng", "Phí sàn giảm còn 4.0%", "Rút tiền tối đa 20.000.000₫/ngày"))
                    .build(),
            SellerTierInfoDTO.TierDetail.builder()
                    .level(4).name("Người bán Vàng (Cấp 4)").badgeTitle("Gold Seller").badgeColor("#d69e2e")
                    .fee(TIER_FEES.get(4)).postLimit(300).commissionRate(3.0)
                    .dailyWithdrawLimit("50.000.000₫/ngày").withdrawSpeed("Duyệt nhanh trong 4h")
                    .benefits(List.of("Đăng tối đa 300 truyện", "Ưu tiên hiển thị top tìm kiếm", "Phí sàn giảm còn 3.0%", "Rút tiền tối đa 50.000.000₫/ngày"))
                    .build(),
            SellerTierInfoDTO.TierDetail.builder()
                    .level(5).name("Đối tác Kim Cương (Cấp 5)").badgeTitle("Diamond Partner").badgeColor("#3182ce")
                    .fee(TIER_FEES.get(5)).postLimit(-1).commissionRate(2.0)
                    .dailyWithdrawLimit("200.000.000₫/ngày").withdrawSpeed("Rút tức thì (Instant)")
                    .benefits(List.of("Không giới hạn bài đăng", "Phí sàn thấp nhất: 2.0%", "Huy hiệu Kim Cương danh giá", "Hỗ trợ kỹ thuật 24/7 riêng"))
                    .build()
    );

    @Override
    @Transactional(readOnly = true)
    public SellerTierInfoDTO getTierInfo(Long userId) {
        if (userId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));

        boolean isSeller = Boolean.TRUE.equals(user.getIsSeller());
        SellerProfile profile = profileRepository.findByUserId(userId).orElse(null);

        int currentLevel = (profile != null && isSeller) ? profile.getLevel() : 0;
        String shopName = profile != null ? profile.getShopName() : user.getFullName();
        String shopDesc = profile != null ? profile.getShopDescription() : "";
        int completedOrders = profile != null ? profile.getTotalCompletedOrders() : 0;
        BigDecimal revenue = profile != null ? profile.getTotalRevenue() : BigDecimal.ZERO;

        SellerTierInfoDTO.TierDetail currentConfig = TIERS_CONFIG.stream()
                .filter(t -> t.getLevel() == currentLevel)
                .findFirst()
                .orElse(null);

        String levelName = currentConfig != null ? currentConfig.getName() : "Khách hàng";
        String badgeTitle = currentConfig != null ? currentConfig.getBadgeTitle() : "User";
        String badgeColor = currentConfig != null ? currentConfig.getBadgeColor() : "#a0aec0";
        int maxPosts = currentConfig != null ? currentConfig.getPostLimit() : 0;
        double commission = currentConfig != null ? currentConfig.getCommissionRate() : 5.0;

        long postCount = isSeller ? productRepository.countBySellerIdAndDeletedAtIsNull(userId) : 0;

        // Tìm đơn PENDING nếu có
        Optional<SellerUpgradeRequest> pending = requestRepository.findFirstByUserIdAndStatus(userId, UpgradeRequestStatus.PENDING);
        List<SellerUpgradeRequest> allHistory = requestRepository.findByUserIdOrderByCreatedAtDesc(userId);
        SellerUpgradeRequest latest = allHistory.isEmpty() ? null : allHistory.get(0);

        return SellerTierInfoDTO.builder()
                .isSeller(isSeller)
                .currentLevel(currentLevel)
                .currentLevelName(levelName)
                .badgeTitle(badgeTitle)
                .badgeColor(badgeColor)
                .shopName(shopName)
                .shopDescription(shopDesc)
                .maxPostLimit(maxPosts)
                .currentPostCount(postCount)
                .commissionRate(commission)
                .totalCompletedOrders(completedOrders)
                .totalRevenue(revenue)
                .tiers(TIERS_CONFIG)
                .pendingRequest(pending.map(this::toDTO).orElse(null))
                .latestRequest(latest != null ? toDTO(latest) : null)
                .build();
    }

    @Override
    @Transactional
    public SellerUpgradeRequestDTO requestUpgrade(Long userId, CreateUpgradeRequestDTO request) {
        if (userId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));

        // 1. Kiểm tra xem đang có đơn PENDING nào không
        if (requestRepository.existsByUserIdAndStatus(userId, UpgradeRequestStatus.PENDING)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bạn đang có một yêu cầu nâng cấp đang chờ Admin xét duyệt. Vui lòng đợi kết quả.");
        }

        SellerProfile profile = profileRepository.findByUserId(userId).orElse(null);
        int currentLevel = (profile != null && Boolean.TRUE.equals(user.getIsSeller())) ? profile.getLevel() : 0;
        int targetLevel = request.getToLevel();

        if (targetLevel <= currentLevel) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cấp độ mục tiêu phải lớn hơn cấp độ hiện tại (" + currentLevel + ")");
        }

        BigDecimal fee = TIER_FEES.getOrDefault(targetLevel, new BigDecimal("100000"));

        String shopName = request.getShopName() != null && !request.getShopName().isBlank()
                ? request.getShopName().trim()
                : (profile != null ? profile.getShopName() : user.getFullName());

        SellerUpgradeRequest entity = new SellerUpgradeRequest();
        entity.setUserId(userId);
        entity.setFromLevel(currentLevel);
        entity.setToLevel(targetLevel);
        entity.setShopName(shopName);
        entity.setShopDescription(request.getShopDescription());
        entity.setFeeAmount(fee);
        entity.setPaymentMethod("MANUAL_TRANSFER");
        entity.setPaymentProofUrl(request.getPaymentProofUrl());
        entity.setTransactionCode(request.getTransactionCode());
        entity.setStatus(UpgradeRequestStatus.PENDING);

        SellerUpgradeRequest saved = requestRepository.save(entity);
        return toDTO(saved);
    }

    @Override
    public String uploadProof(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn ảnh biên lai chuyển khoản");
        }

        // Ưu tiên Cloudinary nếu có cấu hình
        if (uploadService.isConfigured()) {
            try {
                return uploadService.upload(file, "seller-proofs").url();
            } catch (Exception e) {
                log.warn("Cloudinary upload failed, falling back to local storage: {}", e.getMessage());
            }
        }

        // Fallback lưu local an toàn
        try {
            String originalName = file.getOriginalFilename();
            String ext = (originalName != null && originalName.contains("."))
                    ? originalName.substring(originalName.lastIndexOf("."))
                    : ".jpg";
            String filename = "proof_" + UUID.randomUUID().toString().replace("-", "") + ext;

            Path uploadDir = Paths.get("src/main/resources/static/uploads/proofs");
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }

            Path filePath = uploadDir.resolve(filename);
            try (FileOutputStream fos = new FileOutputStream(filePath.toFile())) {
                fos.write(file.getBytes());
            }

            return "/uploads/proofs/" + filename;
        } catch (IOException e) {
            log.error("Failed to save proof image locally", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu tệp ảnh biên lai");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SellerUpgradeRequestDTO> getAdminRequests(String status, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        Page<SellerUpgradeRequest> pageResult;

        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
            try {
                UpgradeRequestStatus enumStatus = UpgradeRequestStatus.valueOf(status.toUpperCase());
                pageResult = requestRepository.findByStatusOrderByCreatedAtDesc(enumStatus, pageable);
            } catch (IllegalArgumentException e) {
                pageResult = requestRepository.findAllByOrderByCreatedAtDesc(pageable);
            }
        } else {
            pageResult = requestRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        return pageResult.map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public SellerUpgradeRequestDTO getAdminRequestDetail(Long requestId) {
        SellerUpgradeRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu nâng cấp"));
        return toDTO(req);
    }

    @Override
    @Transactional
    public SellerUpgradeRequestDTO approveRequest(Long adminId, Long requestId) {
        SellerUpgradeRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu nâng cấp"));

        if (req.getStatus() != UpgradeRequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Yêu cầu này đã được xử lý trước đó (" + req.getStatus() + ")");
        }

        User targetUser = userRepository.findById(req.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng của yêu cầu"));

        // 1. Kích hoạt is_seller = true nếu đang là false
        if (!Boolean.TRUE.equals(targetUser.getIsSeller())) {
            targetUser.setIsSeller(true);
            userRepository.save(targetUser);
        }

        // 2. Cập nhật hoặc tạo seller_profiles với level mới
        SellerProfile profile = profileRepository.findByUserId(targetUser.getId())
                .orElseGet(() -> {
                    SellerProfile p = new SellerProfile();
                    p.setUserId(targetUser.getId());
                    return p;
                });

        profile.setLevel(req.getToLevel());
        if (req.getShopName() != null && !req.getShopName().isBlank()) {
            profile.setShopName(req.getShopName());
        } else if (profile.getShopName() == null || profile.getShopName().isBlank()) {
            profile.setShopName(targetUser.getFullName());
        }
        if (req.getShopDescription() != null) {
            profile.setShopDescription(req.getShopDescription());
        }
        profileRepository.save(profile);

        // 3. Đánh dấu APPROVED
        req.setStatus(UpgradeRequestStatus.APPROVED);
        req.setAdminId(adminId);
        req.setReviewedAt(LocalDateTime.now());
        req.setRejectionReason(null);

        SellerUpgradeRequest saved = requestRepository.save(req);
        return toDTO(saved);
    }

    @Override
    @Transactional
    public SellerUpgradeRequestDTO rejectRequest(Long adminId, Long requestId, String reason) {
        SellerUpgradeRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu nâng cấp"));

        if (req.getStatus() != UpgradeRequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Yêu cầu này đã được xử lý trước đó (" + req.getStatus() + ")");
        }

        req.setStatus(UpgradeRequestStatus.REJECTED);
        req.setAdminId(adminId);
        req.setReviewedAt(LocalDateTime.now());
        req.setRejectionReason((reason != null && !reason.isBlank()) ? reason.trim() : "Thông tin chuyển khoản không khớp hoặc chưa nhận được tiền.");

        SellerUpgradeRequest saved = requestRepository.save(req);
        return toDTO(saved);
    }

    private SellerUpgradeRequestDTO toDTO(SellerUpgradeRequest entity) {
        User user = userRepository.findById(entity.getUserId()).orElse(null);
        User admin = entity.getAdminId() != null ? userRepository.findById(entity.getAdminId()).orElse(null) : null;

        return SellerUpgradeRequestDTO.builder()
                .id(entity.getId())
                .userId(entity.getUserId())
                .userFullName(user != null ? user.getFullName() : "N/A")
                .userEmail(user != null ? user.getEmail() : "N/A")
                .userPhone(user != null ? user.getPhone() : "")
                .fromLevel(entity.getFromLevel())
                .toLevel(entity.getToLevel())
                .shopName(entity.getShopName())
                .shopDescription(entity.getShopDescription())
                .feeAmount(entity.getFeeAmount())
                .paymentMethod(entity.getPaymentMethod())
                .paymentProofUrl(entity.getPaymentProofUrl())
                .transactionCode(entity.getTransactionCode())
                .status(entity.getStatus().name())
                .adminId(entity.getAdminId())
                .adminName(admin != null ? admin.getFullName() : null)
                .rejectionReason(entity.getRejectionReason())
                .createdAt(entity.getCreatedAt())
                .reviewedAt(entity.getReviewedAt())
                .build();
    }
}

