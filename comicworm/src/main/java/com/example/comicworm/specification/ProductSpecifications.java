package com.example.comicworm.specification;

import com.example.comicworm.dto.request.ProductSearchRequest;
import com.example.comicworm.dto.request.ProductSort;
import com.example.comicworm.model.Author;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderItem;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.utils.ConditionGrade;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Các điều kiện truy vấn Product. Mọi danh sách công khai đều phải qua {@link #visible()}. */
public final class ProductSpecifications {

    private ProductSpecifications() {
    }

    /** Tin được phép hiển thị công khai: đã duyệt, đang bật, chưa xóa mềm (T10). */
    public static Specification<Product> visible() {
        return (root, query, cb) -> visiblePredicate(root, cb);
    }

    public static Specification<Product> sameCategoryExcept(Integer categoryId, Long excludedProductId) {
        return (root, query, cb) -> cb.and(
                cb.equal(root.get("categoryId"), categoryId),
                cb.notEqual(root.get("id"), excludedProductId));
    }

    public static Specification<Product> ofSeller(Long sellerId) {
        return (root, query, cb) -> cb.equal(root.get("sellerId"), sellerId);
    }

    /**
     * Tìm kiếm + lọc cho trang danh mục.
     *
     * @param categoryIds null = không lọc thể loại; danh sách đã gồm thể loại con
     */
    public static Specification<Product> search(ProductSearchRequest req, List<Integer> categoryIds, ProductSort sort) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(visiblePredicate(root, cb));

            if (categoryIds != null && !categoryIds.isEmpty()) {
                predicates.add(root.get("categoryId").in(categoryIds));
            }
            if (req.getPublisherId() != null) {
                predicates.add(cb.equal(root.get("publisherId"), req.getPublisherId()));
            }
            if (req.getAuthorId() != null) {
                predicates.add(cb.equal(root.get("authorId"), req.getAuthorId()));
            }
            if (req.getSellerId() != null) {
                predicates.add(cb.equal(root.get("sellerId"), req.getSellerId()));
            }
            if (req.getMinPrice() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.<java.math.BigDecimal>get("price"), req.getMinPrice()));
            }
            if (req.getMaxPrice() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.<java.math.BigDecimal>get("price"), req.getMaxPrice()));
            }

            Predicate conditionPredicate = conditionPredicate(req.getConditions(), root, cb);
            if (conditionPredicate != null) {
                predicates.add(conditionPredicate);
            }

            if (req.getListingType() != null) {
                predicates.add(listingTypePredicate(req.getListingType(), root, cb));
            }

            if (req.getKeyword() != null && !req.getKeyword().isBlank()) {
                String like = "%" + escapeLike(req.getKeyword().trim().toLowerCase(Locale.ROOT)) + "%";
                Join<Product, Author> author = root.join("author", JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.<String>get("title")), like, '\\'),
                        cb.like(cb.lower(author.<String>get("name")), like, '\\')));
            }

            // Sắp xếp "bán chạy" cần ORDER BY bằng subquery nên làm ở đây.
            // Bỏ qua với câu COUNT do Spring Data tự sinh (resultType = Long).
            boolean isCountQuery = Long.class.equals(query.getResultType()) || long.class.equals(query.getResultType());
            if (sort == ProductSort.POPULAR && !isCountQuery) {
                Subquery<Long> sold = query.subquery(Long.class);
                Root<OrderItem> oi = sold.from(OrderItem.class);
                Root<Order> o = sold.from(Order.class);
                sold.select(cb.coalesce(cb.sumAsLong(oi.<Integer>get("quantity")), 0L));
                sold.where(
                        cb.equal(oi.get("productId"), root.get("id")),
                        cb.equal(o.get("id"), oi.get("orderId")),
                        cb.equal(o.get("status"), OrderStatus.COMPLETED));
                query.orderBy(cb.desc(sold), cb.desc(root.get("createdAt")), cb.desc(root.get("id")));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static Predicate visiblePredicate(Root<Product> root, CriteriaBuilder cb) {
        return cb.and(
                cb.equal(root.get("moderationStatus"), ModerationStatus.APPROVED),
                cb.isTrue(root.<Boolean>get("isActive")),
                cb.isNull(root.get("deletedAt")));
    }

    private static Predicate conditionPredicate(List<String> codes, Root<Product> root, CriteriaBuilder cb) {
        if (codes == null || codes.isEmpty()) return null;
        List<Predicate> ranges = new ArrayList<>();
        for (String code : codes) {
            ConditionGrade.parse(code).ifPresent(grade -> ranges.add(
                    cb.between(root.<Integer>get("conditionPercent"), grade.getMin(), grade.getMax())));
        }
        return ranges.isEmpty() ? null : cb.or(ranges.toArray(new Predicate[0]));
    }

    private static Predicate listingTypePredicate(ListingType type, Root<Product> root, CriteriaBuilder cb) {
        return switch (type) {
            case SELL -> root.get("listingType").in(ListingType.SELL, ListingType.SELL_AND_TRADE);
            case TRADE -> root.get("listingType").in(ListingType.TRADE, ListingType.SELL_AND_TRADE);
            case SELL_AND_TRADE -> cb.equal(root.get("listingType"), ListingType.SELL_AND_TRADE);
        };
    }

    /** Chặn ký tự đại diện của LIKE do người dùng nhập (% và _). */
    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
