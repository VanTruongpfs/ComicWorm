package com.example.comicworm.mapper;

import com.example.comicworm.dto.response.ProductCardDTO;
import com.example.comicworm.dto.response.ProductDetailDTO;
import com.example.comicworm.dto.response.ReviewDTO;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.Review;
import com.example.comicworm.model.ReviewReply;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.utils.ConditionGrade;
import org.springframework.stereotype.Component;

import java.util.List;

/** Chuyển Product/Review (entity) sang DTO. Không truy cập quan hệ lazy: dữ liệu liên quan do service nạp sẵn. */
@Component
public class ProductMapper {

    public ProductCardDTO toCard(Product p,
                                 String coverImageUrl,
                                 String categoryName,
                                 String authorName,
                                 String publisherName,
                                 String sellerName,
                                 long soldCount) {
        return ProductCardDTO.builder()
                .id(p.getId())
                .slug(p.getSlug())
                .title(p.getTitle())
                .coverImageUrl(coverImageUrl)
                .price(p.getPrice())
                .conditionPercent(p.getConditionPercent())
                .conditionLabel(conditionLabel(p))
                .listingType(p.getListingType())
                .purchasable(isPurchasableType(p))
                .tradable(isTradableType(p))
                .stockQuantity(p.getStockQuantity())
                .inStock(p.getStockQuantity() != null && p.getStockQuantity() > 0)
                .volumeNumbers(p.getVolumeNumbers())
                .editionType(p.getEditionType())
                .publicationYear(p.getPublicationYear())
                .categoryId(p.getCategoryId())
                .categoryName(categoryName)
                .authorName(authorName)
                .publisherName(publisherName)
                .sellerId(p.getSellerId())
                .sellerName(sellerName)
                .soldCount(soldCount)
                .createdAt(p.getCreatedAt())
                .build();
    }

    public ProductDetailDTO.Image toImage(ProductImage img) {
        return ProductDetailDTO.Image.builder()
                .id(img.getId())
                .url(img.getImageUrl())
                .displayOrder(img.getDisplayOrder())
                .build();
    }

    public ProductDetailDTO toDetail(Product p,
                                     boolean publiclyVisible,
                                     List<ProductImage> images,
                                     List<ProductDetailDTO.CategoryRef> categoryPath,
                                     ProductDetailDTO.NamedRef author,
                                     ProductDetailDTO.NamedRef publisher,
                                     ProductDetailDTO.Seller seller,
                                     Double ratingAverage,
                                     long ratingCount,
                                     long soldCount) {
        boolean inStock = p.getStockQuantity() != null && p.getStockQuantity() > 0;
        return ProductDetailDTO.builder()
                .id(p.getId())
                .slug(p.getSlug())
                .title(p.getTitle())
                .description(p.getDescription())
                .price(p.getPrice())
                .stockQuantity(p.getStockQuantity())
                .inStock(inStock)
                .listingType(p.getListingType())
                .purchasable(publiclyVisible && inStock && isPurchasableType(p))
                .tradable(publiclyVisible && isTradableType(p))
                .tradeWishNote(p.getTradeWishNote())
                .conditionPercent(p.getConditionPercent())
                .conditionLabel(conditionLabel(p))
                .volumeNumbers(p.getVolumeNumbers())
                .editionType(p.getEditionType())
                .publicationYear(p.getPublicationYear())
                .images(images.stream().map(this::toImage).toList())
                .categoryPath(categoryPath)
                .author(author)
                .publisher(publisher)
                .seller(seller)
                .ratingAverage(ratingAverage)
                .ratingCount(ratingCount)
                .soldCount(soldCount)
                .publiclyVisible(publiclyVisible)
                .moderationStatus(p.getModerationStatus())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }

    public ProductDetailDTO.Seller toSeller(User seller, long activeProductCount, Double ratingAverage, long ratingCount) {
        if (seller == null) return null;
        return ProductDetailDTO.Seller.builder()
                .id(seller.getId())
                .fullName(seller.getFullName())
                .avatarUrl(seller.getAvatarUrl())
                .memberSince(seller.getCreatedAt())
                .activeProductCount(activeProductCount)
                .ratingAverage(ratingAverage)
                .ratingCount(ratingCount)
                .build();
    }

    public ReviewDTO toReview(Review review, User buyer, ReviewReply reply, User replySeller) {
        ReviewDTO.Reply replyDto = reply == null ? null : ReviewDTO.Reply.builder()
                .content(reply.getContent())
                .sellerName(replySeller != null ? replySeller.getFullName() : null)
                .createdAt(reply.getCreatedAt())
                .build();
        return ReviewDTO.builder()
                .id(review.getId())
                .rating(review.getRating())
                .content(review.getContent())
                .buyerName(buyer != null ? buyer.getFullName() : "Người dùng ẩn danh")
                .buyerAvatarUrl(buyer != null ? buyer.getAvatarUrl() : null)
                .createdAt(review.getCreatedAt())
                .reply(replyDto)
                .build();
    }

    private String conditionLabel(Product p) {
        int percent = p.getConditionPercent() == null ? 0 : p.getConditionPercent();
        return ConditionGrade.fromPercent(percent).labelFor(percent);
    }

    private boolean isPurchasableType(Product p) {
        return p.getListingType() == ListingType.SELL || p.getListingType() == ListingType.SELL_AND_TRADE;
    }

    private boolean isTradableType(Product p) {
        return p.getListingType() == ListingType.TRADE || p.getListingType() == ListingType.SELL_AND_TRADE;
    }
}
