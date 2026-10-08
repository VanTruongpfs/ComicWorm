package com.example.comicworm.service.seller;

import com.example.comicworm.dto.request.SellerProductRequest;
import com.example.comicworm.dto.response.SellerProductRecord;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.repository.*;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

@Service
@Profile("!preview")
@Transactional(readOnly = true)
public class SellerProductService {
    private final ProductRepository products;
    private final CategoryRepository categories;
    private final AuthorRepository authors;
    private final PublisherRepository publishers;
    private final ProductImageRepository images;
    private final SellerProductImageService productImages;
    private static final Set<String> SORT_FIELDS = Set.of("id", "title", "price", "stockQuantity",
            "conditionPercent", "isActive", "moderationStatus", "createdAt");

    public SellerProductService(ProductRepository products, CategoryRepository categories,
            AuthorRepository authors, PublisherRepository publishers, ProductImageRepository images, SellerProductImageService productImages) {
        this.products = products; this.categories = categories; this.authors = authors; this.publishers = publishers;
        this.images = images;
        this.productImages = productImages;
    }

    public Map<String, Object> list(Long sellerId, int start, int size, String sorting,
            String search, Integer categoryId, String stock) {
        if (size < 1 || size > 100 || start < 0 || start % size != 0) {
            throw badRequest("Phân trang không hợp lệ (tối đa 100 sản phẩm/trang).");
        }
        if (search.length() > 255) throw badRequest("Từ khóa tìm kiếm tối đa 255 ký tự.");
        if (!Set.of("all", "in_stock", "low_stock", "out_of_stock").contains(stock)) {
            throw badRequest("Bộ lọc tồn kho không hợp lệ.");
        }
        Specification<Product> scope = (root, query, builder) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(builder.equal(root.get("sellerId"), sellerId));
            predicates.add(builder.isNull(root.get("deletedAt")));
            if (!search.isBlank()) {
                String term = search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\")
                        .replace("%", "\\%").replace("_", "\\_");
                var title = builder.like(builder.lower(root.get("title")), "%" + term + "%", '\\');
                try { predicates.add(builder.or(title, builder.equal(root.get("id"), Long.parseLong(search.trim())))); }
                catch (NumberFormatException ignored) { predicates.add(title); }
            }
            if (categoryId != null) predicates.add(builder.equal(root.get("categoryId"), categoryId));
            if (stock.equals("in_stock")) predicates.add(builder.greaterThan(root.get("stockQuantity"), 0));
            if (stock.equals("low_stock")) {
                predicates.add(builder.greaterThan(root.get("stockQuantity"), 0));
                predicates.add(builder.lessThan(root.get("stockQuantity"), 3));
            }
            if (stock.equals("out_of_stock")) predicates.add(builder.equal(root.get("stockQuantity"), 0));
            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var page = products.findAll(scope, PageRequest.of(start / size, size, parseSort(sorting)));
        var imageGroups = page.isEmpty() ? Map.<Long, List<com.example.comicworm.model.ProductImage>>of()
                : images.findByProductIdInOrderByDisplayOrderAscIdAsc(page.getContent().stream().map(Product::getId).toList())
                    .stream().collect(java.util.stream.Collectors.groupingBy(com.example.comicworm.model.ProductImage::getProductId));
        return Map.of("Result", "OK", "Records", page.map(product -> SellerProductRecord.from(product,
                imageGroups.getOrDefault(product.getId(), List.of()))).getContent(),
                "TotalRecordCount", page.getTotalElements(), "Summary", summary(sellerId));
    }

    public SellerProductRecord get(Long sellerId, Long id) { return record(owned(sellerId, id)); }

    private SellerProductRecord record(Product product) {
        return SellerProductRecord.from(product, images.findByProductIdOrderByDisplayOrderAscIdAsc(product.getId()));
    }

    public Map<String, Object> options() {
        Sort sort = Sort.by("name");
        return Map.of("Result", "OK",
                "categories", categories.findAll(sort).stream().map(item -> option(item.getId(), item.getName())).toList(),
                "authors", authors.findAll(sort).stream().map(item -> option(item.getId(), item.getName())).toList(),
                "publishers", publishers.findAll(sort).stream().map(item -> option(item.getId(), item.getName())).toList());
    }

    private Map<String, Object> option(Integer id, String name) { return Map.of("Value", id, "DisplayText", name); }

    public Map<String, Object> summary(Long sellerId) {
        var summary = products.summarizeInventory(sellerId);
        return Map.of("productCount", summary.getProductCount(), "stockQuantity", summary.getStockQuantity(),
                "lowStockCount", summary.getLowStockCount(), "outOfStockCount", summary.getOutOfStockCount(),
                "inventoryValue", summary.getInventoryValue());
    }

    @Transactional
    public SellerProductRecord create(Long sellerId, SellerProductRequest request) {
        validateReferences(request);
        var product = new Product();
        product.setSellerId(sellerId);
        product.setSlug(slug(request.title()));
        apply(product, request);
        return record(products.saveAndFlush(product));
    }

    @Transactional
    public SellerProductRecord update(Long sellerId, Long id, SellerProductRequest request) {
        var product = lockOwned(sellerId, id);
        validateReferences(request);
        apply(product, request);
        return record(products.saveAndFlush(product));
    }

    @Transactional
    public void delete(Long sellerId, Long id) {
        var product = lockOwned(sellerId, id);
        product.setIsActive(false);
        product.setDeletedAt(LocalDateTime.now(ZoneOffset.UTC));
        products.saveAndFlush(product);
    }

    @Transactional
    public SellerProductRecord createWithImages(Long sellerId, SellerProductRequest request, MultipartFile cover,
            List<MultipartFile> details) {
        if (cover == null || cover.isEmpty()) throw badRequest("Vui lòng chọn ảnh bìa sản phẩm.");
        var created = create(sellerId, request);
        productImages.save(sellerId, created.id(), cover, details, List.of());
        return get(sellerId, created.id());
    }

    @Transactional
    public SellerProductRecord updateWithImages(Long sellerId, Long id, SellerProductRequest request, MultipartFile cover,
            List<MultipartFile> details, List<Long> removeIds) {
        update(sellerId, id, request);
        productImages.save(sellerId, id, cover, details, removeIds);
        return get(sellerId, id);
    }

    private Product owned(Long sellerId, Long id) {
        return products.findByIdAndSellerIdAndDeletedAtIsNull(id, sellerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm trong gian hàng của bạn."));
    }

    private Product lockOwned(Long sellerId, Long id) {
        return products.lockOwnedProduct(id, sellerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm trong gian hàng của bạn."));
    }

    private void validateReferences(SellerProductRequest request) {
        if (!categories.existsById(request.categoryId())) throw badRequest("Thể loại đã chọn không tồn tại.");
        if (request.authorId() != null && !authors.existsById(request.authorId())) throw badRequest("Tác giả đã chọn không tồn tại.");
        if (request.publisherId() != null && !publishers.existsById(request.publisherId())) throw badRequest("Nhà xuất bản đã chọn không tồn tại.");
    }

    private void apply(Product product, SellerProductRequest request) {
        product.setTitle(request.title().trim()); product.setDescription(request.description().trim());
        product.setCategoryId(request.categoryId()); product.setAuthorId(request.authorId());
        product.setPublisherId(request.publisherId()); product.setVolumeNumbers(trim(request.volumeNumbers()));
        product.setEditionType(trim(request.editionType())); product.setPublicationYear(request.publicationYear());
        product.setConditionPercent(request.conditionPercent()); product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity()); product.setListingType(request.listingType());
        product.setTradeWishNote(trim(request.tradeWishNote())); product.setIsActive(request.isActive());
        product.setModerationStatus(ModerationStatus.PENDING);
        product.setModeratedBy(null); product.setModeratedAt(null); product.setModerationReason(null);
    }

    private String trim(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private String slug(String title) {
        String prefix = Normalizer.normalize(title.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd').replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        if (prefix.isEmpty()) prefix = "truyen";
        if (prefix.length() > 210) prefix = prefix.substring(0, 210);
        return prefix + "-" + UUID.randomUUID();
    }

    private Sort parseSort(String sorting) {
        var orders = new ArrayList<Sort.Order>();
        String[] parts = sorting.trim().split(",");
        if (parts.length > 3) throw badRequest("Tối đa 3 cột sắp xếp.");
        for (String part : parts) {
            String[] column = part.trim().split("\\s+");
            if (column.length != 2 || !SORT_FIELDS.contains(column[0])
                    || !Set.of("ASC", "DESC").contains(column[1].toUpperCase(Locale.ROOT))) {
                throw badRequest("Cột hoặc chiều sắp xếp không hợp lệ.");
            }
            orders.add(new Sort.Order(Sort.Direction.fromString(column[1]), column[0]));
        }
        if (orders.stream().noneMatch(order -> order.getProperty().equals("id"))) orders.add(Sort.Order.desc("id"));
        return Sort.by(orders);
    }

    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
