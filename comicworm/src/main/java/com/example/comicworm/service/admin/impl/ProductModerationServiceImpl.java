package com.example.comicworm.service.admin.impl;

import com.example.comicworm.dto.response.AdminProductRecord;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.repository.ProductImageRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.service.admin.IProductModerationService;
import jakarta.persistence.criteria.Predicate;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Profile("!preview")
@Transactional(readOnly = true)
public class ProductModerationServiceImpl implements IProductModerationService {

    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;

    public ProductModerationServiceImpl(ProductRepository productRepository,
                                        ProductImageRepository productImageRepository) {
        this.productRepository = productRepository;
        this.productImageRepository = productImageRepository;
    }

    @Override
    public Map<String, Object> list(ModerationStatus status, String keyword, int page, int size) {
        if (size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kích thước trang từ 1 đến 100.");
        }
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số trang không được âm.");
        }

        String cleanKeyword = (keyword == null) ? "" : keyword.trim().toLowerCase(Locale.ROOT);

        Specification<Product> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isNull(root.get("deletedAt")));

            if (status != null) {
                predicates.add(cb.equal(root.get("moderationStatus"), status));
            }

            if (!cleanKeyword.isBlank()) {
                String term = "%" + cleanKeyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                Predicate titleLike = cb.like(cb.lower(root.get("title")), term, '\\');
                try {
                    Long idVal = Long.parseLong(cleanKeyword);
                    predicates.add(cb.or(titleLike, cb.equal(root.get("id"), idVal)));
                } catch (NumberFormatException ignored) {
                    predicates.add(titleLike);
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        var pageResult = productRepository.findAll(spec, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")));

        List<Product> content = pageResult.getContent();
        Map<Long, List<ProductImage>> imageMap;
        if (content.isEmpty()) {
            imageMap = Collections.emptyMap();
        } else {
            List<Long> productIds = content.stream().map(Product::getId).toList();
            imageMap = productImageRepository.findByProductIdInOrderByDisplayOrderAscIdAsc(productIds)
                    .stream()
                    .collect(Collectors.groupingBy(ProductImage::getProductId));
        }

        List<AdminProductRecord> records = content.stream()
                .map(p -> AdminProductRecord.from(p, imageMap.getOrDefault(p.getId(), Collections.emptyList())))
                .toList();

        return Map.of(
                "Result", "OK",
                "Records", records,
                "TotalRecordCount", pageResult.getTotalElements(),
                "TotalPages", pageResult.getTotalPages(),
                "CurrentPage", page,
                "Stats", countStats()
        );
    }

    @Override
    public AdminProductRecord get(Long id) {
        Product product = findActive(id);
        List<ProductImage> images = productImageRepository.findByProductIdOrderByDisplayOrderAscIdAsc(product.getId());
        return AdminProductRecord.from(product, images);
    }

    @Override
    @Transactional
    public AdminProductRecord approve(Long id, Long adminId) {
        Product product = findActive(id);

        product.setModerationStatus(ModerationStatus.APPROVED);
        product.setModeratedBy(adminId);
        product.setModeratedAt(LocalDateTime.now(ZoneOffset.UTC));
        product.setModerationReason(null);

        Product saved = productRepository.saveAndFlush(product);
        List<ProductImage> images = productImageRepository.findByProductIdOrderByDisplayOrderAscIdAsc(saved.getId());
        return AdminProductRecord.from(saved, images);
    }

    @Override
    @Transactional
    public AdminProductRecord reject(Long id, Long adminId, String reason) {
        if (reason == null || reason.trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do từ chối kiểm duyệt.");
        }

        Product product = findActive(id);

        product.setModerationStatus(ModerationStatus.REJECTED);
        product.setModerationReason(reason.trim());
        product.setModeratedBy(adminId);
        product.setModeratedAt(LocalDateTime.now(ZoneOffset.UTC));

        Product saved = productRepository.saveAndFlush(product);
        List<ProductImage> images = productImageRepository.findByProductIdOrderByDisplayOrderAscIdAsc(saved.getId());
        return AdminProductRecord.from(saved, images);
    }

    @Override
    public Map<String, Long> countStats() {
        long pending = productRepository.countByModerationStatusAndDeletedAtIsNull(ModerationStatus.PENDING);
        long approved = productRepository.countByModerationStatusAndDeletedAtIsNull(ModerationStatus.APPROVED);
        long rejected = productRepository.countByModerationStatusAndDeletedAtIsNull(ModerationStatus.REJECTED);
        return Map.of(
                "pending", pending,
                "approved", approved,
                "rejected", rejected
        );
    }

    private Product findActive(Long id) {
        return productRepository.findById(id)
                .filter(p -> p.getDeletedAt() == null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm có mã: " + id));
    }
}
