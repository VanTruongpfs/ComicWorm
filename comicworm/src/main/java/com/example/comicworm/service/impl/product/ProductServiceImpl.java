package com.example.comicworm.service.impl.product;

import com.example.comicworm.dto.request.ProductSearchRequest;
import com.example.comicworm.dto.request.ProductSort;
import com.example.comicworm.dto.response.PageResponseDTO;
import com.example.comicworm.dto.response.ProductCardDTO;
import com.example.comicworm.dto.response.ProductDetailDTO;
import com.example.comicworm.dto.response.ProductFilterOptionsDTO;
import com.example.comicworm.dto.response.ReviewDTO;
import com.example.comicworm.mapper.ProductMapper;
import com.example.comicworm.model.Author;
import com.example.comicworm.model.Category;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.Publisher;
import com.example.comicworm.model.Review;
import com.example.comicworm.model.ReviewReply;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.repository.AuthorRepository;
import com.example.comicworm.repository.CategoryRepository;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.ProductImageRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.PublisherRepository;
import com.example.comicworm.repository.ReviewReplyRepository;
import com.example.comicworm.repository.ReviewRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.product.IProductService;
import com.example.comicworm.specification.ProductSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Nghiệp vụ hiển thị sản phẩm: danh sách (T06, T09, T10) và chi tiết (B04).
 * open-in-view=false nên toàn bộ việc dựng DTO nằm trong transaction readOnly và dùng truy vấn theo lô, không lazy-load.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ProductServiceImpl implements IProductService {

    private static final int MAX_PAGE_SIZE = 48;
    private static final int MAX_HOME_LIMIT = 24;
    private static final int MAX_RELATED_LIMIT = 12;

    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;
    private final CategoryRepository categoryRepository;
    private final AuthorRepository authorRepository;
    private final PublisherRepository publisherRepository;
    private final UserRepository userRepository;
    private final OrderItemRepository orderItemRepository;
    private final ReviewRepository reviewRepository;
    private final ReviewReplyRepository reviewReplyRepository;
    private final ProductMapper productMapper;

    // ------------------------------------------------------------------ DANH SÁCH

    @Override
    public PageResponseDTO<ProductCardDTO> search(ProductSearchRequest request) {
        int page = Math.max(request.getPage(), 0);
        int size = clamp(request.getSize(), 1, MAX_PAGE_SIZE);

        if (request.getMinPrice() != null && request.getMaxPrice() != null
                && request.getMinPrice().compareTo(request.getMaxPrice()) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "minPrice không được lớn hơn maxPrice");
        }

        List<Integer> categoryIds = resolveCategoryIds(request);
        if (categoryIds != null && categoryIds.isEmpty()) {
            // Có yêu cầu lọc thể loại nhưng không thể loại nào khớp -> không có kết quả.
            return PageResponseDTO.empty(page, size);
        }

        ProductSort sort = ProductSort.from(request.getSort());
        Pageable pageable = PageRequest.of(page, size, sort.toSort());
        Page<Product> result = productRepository.findAll(
                ProductSpecifications.search(request, categoryIds, sort), pageable);

        return PageResponseDTO.of(result, toCards(result.getContent()));
    }

    @Override
    public List<ProductCardDTO> getLatest(int limit) {
        Pageable pageable = PageRequest.of(0, clamp(limit, 1, MAX_HOME_LIMIT),
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<Product> page = productRepository.findAll(ProductSpecifications.visible(), pageable);
        return toCards(page.getContent());
    }

    @Override
    public List<ProductCardDTO> getBestSellers(int limit) {
        List<Long> ids = orderItemRepository.findBestSellerProductIds(
                PageRequest.of(0, clamp(limit, 1, MAX_HOME_LIMIT)));
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, Product> byId = productRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        // Giữ đúng thứ tự bán chạy do truy vấn trả về.
        List<Product> ordered = ids.stream().map(byId::get).filter(Objects::nonNull).toList();
        return toCards(ordered);
    }

    @Override
    public ProductFilterOptionsDTO getFilterOptions() {
        Map<Integer, Long> countByCategory = toCountMap(productRepository.countVisibleByCategory());
        Map<Integer, Long> countByPublisher = toCountMap(productRepository.countVisibleByPublisher());

        List<Category> categories = categoryRepository.findAll();
        // Thể loại cha cộng dồn số lượng của các thể loại con.
        Map<Integer, Long> childSum = new HashMap<>();
        for (Category c : categories) {
            if (c.getParentId() != null) {
                childSum.merge(c.getParentId(), countByCategory.getOrDefault(c.getId(), 0L), Long::sum);
            }
        }

        List<ProductFilterOptionsDTO.CategoryOption> categoryOptions = categories.stream()
                .sorted(Comparator.comparing(Category::getName, String.CASE_INSENSITIVE_ORDER))
                .map(c -> ProductFilterOptionsDTO.CategoryOption.builder()
                        .id(c.getId())
                        .name(c.getName())
                        .slug(c.getSlug())
                        .parentId(c.getParentId())
                        .count(countByCategory.getOrDefault(c.getId(), 0L) + childSum.getOrDefault(c.getId(), 0L))
                        .build())
                .toList();

        List<ProductFilterOptionsDTO.PublisherOption> publisherOptions = publisherRepository.findAll().stream()
                .sorted(Comparator.comparing(Publisher::getName, String.CASE_INSENSITIVE_ORDER))
                .map(p -> ProductFilterOptionsDTO.PublisherOption.builder()
                        .id(p.getId())
                        .name(p.getName())
                        .slug(p.getSlug())
                        .count(countByPublisher.getOrDefault(p.getId(), 0L))
                        .build())
                .toList();

        long total = countByCategory.values().stream().mapToLong(Long::longValue).sum();
        return ProductFilterOptionsDTO.builder()
                .totalProducts(total)
                .categories(categoryOptions)
                .publishers(publisherOptions)
                .build();
    }

    // ------------------------------------------------------------------ CHI TIẾT

    @Override
    public ProductDetailDTO getDetail(Long productId, Long viewerId, boolean admin) {
        Product product = productRepository.findById(productId)
                .filter(p -> p.getDeletedAt() == null)
                .orElseThrow(this::notFound);

        boolean publiclyVisible = isPubliclyVisible(product);
        boolean isOwner = viewerId != null && viewerId.equals(product.getSellerId());
        if (!publiclyVisible && !admin && !isOwner) {
            // Không tiết lộ sự tồn tại của tin chờ duyệt / bị từ chối / đã ẩn.
            throw notFound();
        }

        List<ProductImage> images = productImageRepository.findByProductIdOrderByDisplayOrderAsc(productId);

        ProductDetailDTO.NamedRef author = null;
        if (product.getAuthorId() != null) {
            author = authorRepository.findById(product.getAuthorId())
                    .map(a -> ProductDetailDTO.NamedRef.builder().id(a.getId()).name(a.getName()).build())
                    .orElse(null);
        }
        ProductDetailDTO.NamedRef publisher = null;
        if (product.getPublisherId() != null) {
            publisher = publisherRepository.findById(product.getPublisherId())
                    .map(p -> ProductDetailDTO.NamedRef.builder().id(p.getId()).name(p.getName()).build())
                    .orElse(null);
        }

        User sellerUser = userRepository.findById(product.getSellerId()).orElse(null);
        ProductDetailDTO.Seller seller = productMapper.toSeller(
                sellerUser,
                productRepository.count(ProductSpecifications.visible()
                        .and(ProductSpecifications.ofSeller(product.getSellerId()))),
                roundOneDecimal(reviewRepository.averageRatingBySellerId(product.getSellerId())),
                reviewRepository.countBySellerId(product.getSellerId()));

        long sold = soldMap(List.of(productId)).getOrDefault(productId, 0L);

        return productMapper.toDetail(
                product,
                publiclyVisible,
                images,
                buildCategoryPath(product.getCategoryId()),
                author,
                publisher,
                seller,
                roundOneDecimal(reviewRepository.averageRatingByProductId(productId)),
                reviewRepository.countByProductId(productId),
                sold);
    }

    @Override
    public List<ProductCardDTO> getRelated(Long productId, int limit) {
        Product product = requirePublicProduct(productId);
        Pageable pageable = PageRequest.of(0, clamp(limit, 1, MAX_RELATED_LIMIT),
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<Product> related = productRepository.findAll(
                ProductSpecifications.visible()
                        .and(ProductSpecifications.sameCategoryExcept(product.getCategoryId(), productId)),
                pageable);
        return toCards(related.getContent());
    }

    @Override
    public PageResponseDTO<ReviewDTO> getReviews(Long productId, int page, int size) {
        requirePublicProduct(productId);
        int safePage = Math.max(page, 0);
        int safeSize = clamp(size, 1, 20);

        Page<Review> reviews = reviewRepository.findPageByProductId(productId, PageRequest.of(safePage, safeSize));
        if (reviews.isEmpty()) {
            return PageResponseDTO.of(reviews, List.of());
        }

        List<Long> reviewIds = reviews.getContent().stream().map(Review::getId).toList();
        Map<Long, ReviewReply> replyByReview = reviewReplyRepository.findByReviewIdIn(reviewIds).stream()
                .collect(Collectors.toMap(ReviewReply::getReviewId, Function.identity(), (a, b) -> a));

        Set<Long> userIds = new LinkedHashSet<>();
        reviews.getContent().forEach(r -> userIds.add(r.getBuyerId()));
        replyByReview.values().forEach(r -> userIds.add(r.getSellerId()));
        Map<Long, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        List<ReviewDTO> items = reviews.getContent().stream()
                .map(r -> {
                    ReviewReply reply = replyByReview.get(r.getId());
                    return productMapper.toReview(r, users.get(r.getBuyerId()), reply,
                            reply == null ? null : users.get(reply.getSellerId()));
                })
                .toList();
        return PageResponseDTO.of(reviews, items);
    }

    // ------------------------------------------------------------------ HỖ TRỢ

    /** Dựng thẻ sản phẩm cho cả danh sách bằng các truy vấn theo lô (không N+1). */
    private List<ProductCardDTO> toCards(List<Product> products) {
        if (products.isEmpty()) {
            return List.of();
        }
        Set<Long> productIds = products.stream().map(Product::getId).collect(Collectors.toSet());
        Set<Integer> categoryIds = products.stream().map(Product::getCategoryId).collect(Collectors.toSet());
        Set<Integer> authorIds = products.stream().map(Product::getAuthorId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Integer> publisherIds = products.stream().map(Product::getPublisherId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> sellerIds = products.stream().map(Product::getSellerId).collect(Collectors.toSet());

        Map<Integer, String> categoryNames = categoryRepository.findAllById(categoryIds).stream()
                .collect(Collectors.toMap(Category::getId, Category::getName));
        Map<Integer, String> authorNames = authorRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(Author::getId, Author::getName));
        Map<Integer, String> publisherNames = publisherRepository.findAllById(publisherIds).stream()
                .collect(Collectors.toMap(Publisher::getId, Publisher::getName));
        Map<Long, String> sellerNames = userRepository.findAllById(sellerIds).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));

        // Ảnh đã sắp theo (productId, displayOrder) nên ảnh đầu tiên của mỗi sản phẩm là ảnh bìa.
        Map<Long, String> covers = new HashMap<>();
        for (ProductImage img : productImageRepository.findByProductIdInOrderByProductIdAscDisplayOrderAsc(productIds)) {
            covers.putIfAbsent(img.getProductId(), img.getImageUrl());
        }
        Map<Long, Long> sold = soldMap(productIds);

        List<ProductCardDTO> cards = new ArrayList<>(products.size());
        for (Product p : products) {
            cards.add(productMapper.toCard(
                    p,
                    covers.get(p.getId()),
                    categoryNames.get(p.getCategoryId()),
                    p.getAuthorId() == null ? null : authorNames.get(p.getAuthorId()),
                    p.getPublisherId() == null ? null : publisherNames.get(p.getPublisherId()),
                    sellerNames.get(p.getSellerId()),
                    sold.getOrDefault(p.getId(), 0L)));
        }
        return cards;
    }

    private Map<Long, Long> soldMap(Collection<Long> productIds) {
        Map<Long, Long> map = new HashMap<>();
        for (Object[] row : orderItemRepository.sumSoldByProductIds(productIds)) {
            map.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return map;
    }

    private Map<Integer, Long> toCountMap(List<Object[]> rows) {
        Map<Integer, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        return map;
    }

    /**
     * @return null nếu không lọc thể loại; danh sách rỗng nếu có lọc nhưng không khớp thể loại nào;
     *         ngược lại là các id đã gồm thể loại con.
     */
    private List<Integer> resolveCategoryIds(ProductSearchRequest request) {
        Set<Integer> roots = new LinkedHashSet<>();
        boolean filtering = false;

        if (request.getCategoryIds() != null && !request.getCategoryIds().isEmpty()) {
            filtering = true;
            roots.addAll(request.getCategoryIds());
        }
        if (request.getCategorySlug() != null && !request.getCategorySlug().isBlank()) {
            filtering = true;
            categoryRepository.findBySlug(request.getCategorySlug().trim())
                    .ifPresent(c -> roots.add(c.getId()));
        }
        if (!filtering) {
            return null;
        }

        Set<Integer> all = new LinkedHashSet<>(roots);
        for (Integer rootId : roots) {
            categoryRepository.findByParentId(rootId).forEach(child -> all.add(child.getId()));
        }
        return new ArrayList<>(all);
    }

    private List<ProductDetailDTO.CategoryRef> buildCategoryPath(Integer categoryId) {
        List<ProductDetailDTO.CategoryRef> path = new ArrayList<>();
        Integer currentId = categoryId;
        int guard = 0; // chống vòng lặp nếu dữ liệu cha-con bị sai
        while (currentId != null && guard++ < 5) {
            Category c = categoryRepository.findById(currentId).orElse(null);
            if (c == null) break;
            path.add(0, ProductDetailDTO.CategoryRef.builder().id(c.getId()).name(c.getName()).slug(c.getSlug()).build());
            currentId = c.getParentId();
        }
        return path;
    }

    private Product requirePublicProduct(Long productId) {
        return productRepository.findById(productId)
                .filter(this::isPubliclyVisible)
                .orElseThrow(this::notFound);
    }

    private boolean isPubliclyVisible(Product p) {
        return p.getDeletedAt() == null
                && Boolean.TRUE.equals(p.getIsActive())
                && p.getModerationStatus() == ModerationStatus.APPROVED;
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm");
    }

    private Double roundOneDecimal(Double value) {
        if (value == null) return null;
        return java.math.BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private int clamp(int value, int min, int max) {
        return Math.min(Math.max(value, min), max);
    }
}
