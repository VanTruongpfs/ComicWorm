package com.example.comicworm.service;

import com.example.comicworm.dto.request.CreateReviewRequest;
import com.example.comicworm.dto.response.ReviewDTO;
import com.example.comicworm.dto.response.ReviewableItemDTO;

import java.util.List;

public interface IReviewService {

    /**
     * Tạo đánh giá cho một sản phẩm trong đơn hàng đã hoàn tất (COMPLETED).
     */
    ReviewDTO createReview(Long buyerId, CreateReviewRequest request);

    /**
     * Lấy thông tin sản phẩm và trạng thái đánh giá theo orderItemId.
     */
    ReviewableItemDTO getReviewableItem(Long buyerId, Long orderItemId);

    /**
     * Lấy danh sách các sản phẩm và trạng thái đánh giá trong một đơn hàng.
     */
    List<ReviewableItemDTO> getReviewableItemsByOrder(Long buyerId, Long orderId);

    /**
     * Lấy danh sách các sản phẩm và trạng thái đánh giá theo mã đơn hàng (orderCode).
     */
    List<ReviewableItemDTO> getReviewableItemsByOrderCode(Long buyerId, String orderCode);

    /**
     * Lấy danh sách toàn bộ các sản phẩm đã mua của người dùng hiện tại (ưu tiên đơn COMPLETED).
     */
    List<ReviewableItemDTO> getMyReviewableItems(Long buyerId);
}

