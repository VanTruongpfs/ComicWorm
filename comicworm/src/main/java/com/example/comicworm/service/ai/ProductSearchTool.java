package com.example.comicworm.service.ai;

import com.example.comicworm.dto.request.ai.ProductSearchRequestAI;
import com.example.comicworm.dto.response.ai.ProductChatSummaryDTO;
import com.example.comicworm.dto.response.ai.ProductSearchResponseAI;
import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.utils.TempChatContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

@Component("productSearchFunction")
@Profile("!preview")
public class ProductSearchTool implements Function<ProductSearchRequestAI, ProductSearchResponseAI> {

    private static final Logger log = LoggerFactory.getLogger(ProductSearchTool.class);
    private final EntityManager em;

    @Autowired
    public ProductSearchTool(EntityManager em) {
        this.em = em;
    }

    @Override
    @Transactional(readOnly = true)
    public ProductSearchResponseAI apply(ProductSearchRequestAI request) {
        List<ProductChatSummaryDTO> dtoList = new ArrayList<>();
        try {
            StringBuilder jpql = new StringBuilder(
                    "SELECT new com.example.comicworm.dto.response.ai.ProductChatSummaryDTO(" +
                            "p.id, p.title, p.slug, p.price, p.coverImageUrl, " +
                            "p.conditionPercent, p.volumeNumbers, p.editionType, " +
                            "p.stockQuantity, p.listingType, a.name, c.name) " +
                            "FROM Product p LEFT JOIN p.author a JOIN p.category c " +
                            "WHERE p.isActive = true " +
                            "  AND p.moderationStatus = :status " +
                            "  AND p.deletedAt IS NULL " +
                            "  AND p.stockQuantity > 0 "
            );

            if (request.keyword() != null && !request.keyword().isBlank()) {
                jpql.append("  AND (LOWER(p.title) LIKE LOWER(:keyword) " +
                        "       OR LOWER(p.volumeNumbers) LIKE LOWER(:keyword) " +
                        "       OR LOWER(p.description) LIKE LOWER(:keyword) " +
                        "       OR LOWER(a.name) LIKE LOWER(:keyword) " +
                        "       OR LOWER(c.name) LIKE LOWER(:keyword)) ");
            }

            if (request.maxPrice() != null) {
                jpql.append("  AND p.price <= :maxPrice ");
            }

            if (request.minConditionPercent() != null) {
                jpql.append("  AND p.conditionPercent >= :minCondition ");
            }

            if (request.listingType() != null && !request.listingType().isBlank()) {
                jpql.append("  AND p.listingType = :listingType ");
            }

            if (request.keyword() != null && !request.keyword().isBlank()) {
                jpql.append("ORDER BY CASE WHEN LOWER(p.title) = LOWER(:exactKeyword) THEN 0 " +
                        "WHEN LOWER(p.title) LIKE LOWER(:keyword) THEN 1 " +
                        "WHEN LOWER(a.name) LIKE LOWER(:keyword) OR LOWER(c.name) LIKE LOWER(:keyword) THEN 2 " +
                        "ELSE 3 END, p.createdAt DESC");
            } else {
                jpql.append("ORDER BY p.createdAt DESC");
            }

            Query query = em.createQuery(jpql.toString());
            query.setParameter("status", ModerationStatus.APPROVED);

            if (request.keyword() != null && !request.keyword().isBlank()) {
                String keyword = request.keyword().trim();
                query.setParameter("keyword", "%" + keyword + "%");
                query.setParameter("exactKeyword", keyword);
            }

            if (request.maxPrice() != null) {
                query.setParameter("maxPrice", request.maxPrice());
            }

            if (request.minConditionPercent() != null) {
                query.setParameter("minCondition", request.minConditionPercent());
            }

            if (request.listingType() != null && !request.listingType().isBlank()) {
                query.setParameter("listingType", ListingType.valueOf(request.listingType().trim().toUpperCase()));
            }

            query.setMaxResults(7);
            @SuppressWarnings("unchecked")
            List<ProductChatSummaryDTO> results = query.getResultList();
            dtoList.addAll(results);
            log.warn("" + dtoList.size());
            log.warn(request.toString());
        } catch (RuntimeException e) {
            log.warn("Không thể tìm sản phẩm cho chatbot: {}", e.getMessage());
        }

        TempChatContext.setProducts(dtoList);
        return new ProductSearchResponseAI(dtoList);
    }
}