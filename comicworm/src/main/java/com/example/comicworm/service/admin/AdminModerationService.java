package com.example.comicworm.service.admin;

import com.example.comicworm.dto.response.admin.AdminProductModerationDTO;
import com.example.comicworm.model.Author;
import com.example.comicworm.model.Category;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.Publisher;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.model.enums.ProductImageType;
import com.example.comicworm.repository.AuthorRepository;
import com.example.comicworm.repository.CategoryRepository;
import com.example.comicworm.repository.ProductImageRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.PublisherRepository;
import com.example.comicworm.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Admin review of product listings: list pending posts, approve, or reject with a reason.
 * Only the owner-facing {@code SellerProductService} may put a listing back to PENDING (on edit).
 */
@Service
@Transactional(readOnly = true)
public class AdminModerationService {
    static final int MAX_PAGE_SIZE = 50;

    private final ProductRepository products;
    private final ProductImageRepository images;
    private final UserRepository users;
    private final CategoryRepository categories;
    private final AuthorRepository authors;
    private final PublisherRepository publishers;

    public AdminModerationService(ProductRepository products, ProductImageRepository images, UserRepository users,
                                  CategoryRepository categories, AuthorRepository authors,
                                  PublisherRepository publishers) {
        this.products = products;
        this.images = images;
        this.users = users;
        this.categories = categories;
        this.authors = authors;
        this.publishers = publishers;
    }

    public Map<String, Object> list(ModerationStatus status, String search, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw badRequest("Phân trang không hợp lệ (tối đa " + MAX_PAGE_SIZE + " bài/trang).");
        }
        String term = search == null ? "" : search.trim();
        if (term.length() > 255) throw badRequest("Từ khóa tìm kiếm tối đa 255 ký tự.");

        Specification<Product> spec = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("moderationStatus"), status));
            predicates.add(builder.isNull(root.get("deletedAt")));
            if (!term.isEmpty()) {
                String like = "%" + term.toLowerCase(Locale.ROOT).replace("\\", "\\\\")
                        .replace("%", "\\%").replace("_", "\\_") + "%";
                Predicate byTitle = builder.like(builder.lower(root.get("title")), like, '\\');
                try {
                    predicates.add(builder.or(byTitle, builder.equal(root.get("id"), Long.parseLong(term))));
                } catch (NumberFormatException ignored) {
                    predicates.add(byTitle);
                }
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };

        // Pending: oldest first (FIFO queue). History tabs: most recently handled first.
        Sort sort = status == ModerationStatus.PENDING
                ? Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"))
                : Sort.by(Sort.Order.desc("moderatedAt"), Sort.Order.desc("id"));
        Page<Product> result = products.findAll(spec, PageRequest.of(page, size, sort));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", toDtos(result.getContent()));
        body.put("total", result.getTotalElements());
        body.put("page", page);
        body.put("size", size);
        body.put("counts", counts());
        return body;
    }

    public AdminProductModerationDTO get(Long id) {
        Product product = products.findById(id).filter(p -> p.getDeletedAt() == null)
                .orElseThrow(this::notFound);
        return toDtos(List.of(product)).get(0);
    }

    public Map<String, Long> counts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (ModerationStatus status : ModerationStatus.values()) {
            counts.put(status.name(), products.countByModerationStatusAndDeletedAtIsNull(status));
        }
        return counts;
    }

    @Transactional
    public AdminProductModerationDTO approve(Long adminId, Long productId) {
        Product product = lockPending(productId);
        product.setModerationStatus(ModerationStatus.APPROVED);
        product.setModerationReason(null);
        stamp(product, adminId);
        products.saveAndFlush(product);
        return toDtos(List.of(product)).get(0);
    }

    @Transactional
    public AdminProductModerationDTO reject(Long adminId, Long productId, String reason) {
        String cleanReason = reason == null ? "" : reason.trim();
        if (cleanReason.length() < 5) throw badRequest("Vui lòng nhập lý do từ chối (tối thiểu 5 ký tự).");
        if (cleanReason.length() > 1000) throw badRequest("Lý do từ chối tối đa 1000 ký tự.");
        Product product = lockPending(productId);
        product.setModerationStatus(ModerationStatus.REJECTED);
        product.setModerationReason(cleanReason);
        stamp(product, adminId);
        products.saveAndFlush(product);
        return toDtos(List.of(product)).get(0);
    }

    // ------------------------------------------------------------------ helpers

    private Product lockPending(Long productId) {
        Product product = products.lockForModeration(productId).orElseThrow(this::notFound);
        if (product.getModerationStatus() != ModerationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Bài đăng này đã được xử lý trước đó. Vui lòng tải lại danh sách.");
        }
        return product;
    }

    private void stamp(Product product, Long adminId) {
        product.setModeratedBy(adminId);
        product.setModeratedAt(LocalDateTime.now(ZoneOffset.UTC));
    }

    private List<AdminProductModerationDTO> toDtos(List<Product> list) {
        if (list.isEmpty()) return List.of();
        Map<Long, User> userById = byId(users.findAllById(ids(list, Product::getSellerId, Product::getModeratedBy)), User::getId);
        Map<Integer, Category> categoryById = byId(categories.findAllById(ids(list, Product::getCategoryId)), Category::getId);
        Map<Integer, Author> authorById = byId(authors.findAllById(ids(list, Product::getAuthorId)), Author::getId);
        Map<Integer, Publisher> publisherById = byId(publishers.findAllById(ids(list, Product::getPublisherId)), Publisher::getId);
        Map<Long, List<ProductImage>> imagesByProduct = images
                .findByProductIdInOrderByDisplayOrderAscIdAsc(list.stream().map(Product::getId).toList())
                .stream().collect(Collectors.groupingBy(ProductImage::getProductId));

        List<AdminProductModerationDTO> out = new ArrayList<>();
        for (Product p : list) {
            User seller = userById.get(p.getSellerId());
            User moderator = p.getModeratedBy() == null ? null : userById.get(p.getModeratedBy());
            List<String> urls = imagesByProduct.getOrDefault(p.getId(), List.of()).stream()
                    .sorted(Comparator.comparing((ProductImage i) -> i.getImageType() != ProductImageType.COVER))
                    .map(ProductImage::getImageUrl).toList();
            String cover = p.getCoverImageUrl() != null ? p.getCoverImageUrl() : urls.stream().findFirst().orElse(null);
            out.add(new AdminProductModerationDTO(p.getId(), p.getTitle(), p.getDescription(), p.getPrice(),
                    p.getConditionPercent(), p.getStockQuantity(), p.getListingType(), p.getTradeWishNote(),
                    name(categoryById.get(p.getCategoryId()), Category::getName),
                    p.getAuthorId() == null ? null : name(authorById.get(p.getAuthorId()), Author::getName),
                    p.getPublisherId() == null ? null : name(publisherById.get(p.getPublisherId()), Publisher::getName),
                    p.getVolumeNumbers(), p.getEditionType(), p.getPublicationYear(), p.getIsActive(),
                    cover, urls, p.getSellerId(),
                    seller == null ? null : seller.getFullName(), seller == null ? null : seller.getEmail(),
                    p.getModerationStatus(), p.getModerationReason(),
                    moderator == null ? null : moderator.getFullName(), p.getModeratedAt(),
                    p.getCreatedAt(), p.getUpdatedAt()));
        }
        return out;
    }

    @SafeVarargs
    private static <T, K> Set<K> ids(Collection<T> source, Function<T, K>... getters) {
        Set<K> ids = new java.util.LinkedHashSet<>();
        for (T item : source) {
            for (Function<T, K> getter : getters) {
                K id = getter.apply(item);
                if (id != null) ids.add(id);
            }
        }
        return ids;
    }

    private static <T, K> Map<K, T> byId(List<T> source, Function<T, K> idOf) {
        Map<K, T> map = new HashMap<>();
        for (T item : source) map.put(idOf.apply(item), item);
        return map;
    }

    private static <T> String name(T entity, Function<T, String> getter) {
        return entity == null ? null : getter.apply(entity);
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài đăng.");
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
