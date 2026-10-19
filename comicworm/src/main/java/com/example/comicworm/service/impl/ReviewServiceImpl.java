package com.example.comicworm.service.impl;

import com.example.comicworm.dto.request.CreateReviewRequest;
import com.example.comicworm.dto.response.ReviewDTO;
import com.example.comicworm.dto.response.ReviewableItemDTO;
import com.example.comicworm.mapper.ProductMapper;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderItem;
import com.example.comicworm.model.Review;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.ReviewRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.IReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements IReviewService {

    private final ReviewRepository reviewRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final ProductMapper productMapper;

    @Override
    @Transactional
    public ReviewDTO createReview(Long buyerId, CreateReviewRequest request) {
        if (buyerId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để thực hiện đánh giá");
        }

        OrderItem item = orderItemRepository.findById(request.getOrderItemId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm trong đơn"));

        Order order = item.getOrder() != null ? item.getOrder()
                : orderRepository.findById(item.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng tương ứng"));

        // 1. Chỉ người mua đơn hàng mới được phép đánh giá
        if (!order.getBuyerId().equals(buyerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền đánh giá đơn hàng này");
        }

        // 2. Chỉ đơn hàng có trạng thái COMPLETED mới được phép đánh giá
        if (order.getStatus() != OrderStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ đơn hàng đã giao thành công (COMPLETED) mới được phép đánh giá");
        }

        // 3. Mỗi sản phẩm trong đơn hàng chỉ được đánh giá 1 lần
        if (reviewRepository.existsByOrderItemId(item.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sản phẩm này đã được bạn đánh giá trước đó");
        }

        int rating = request.getRating();
        int qualityRating = request.getProductQualityRating() != null ? request.getProductQualityRating() : rating;
        int attitudeRating = request.getSellerAttitudeRating() != null ? request.getSellerAttitudeRating() : rating;

        Review review = new Review();
        review.setOrderItemId(item.getId());
        review.setBuyerId(buyerId);
        review.setRating(rating);
        review.setProductQualityRating(qualityRating);
        review.setSellerAttitudeRating(attitudeRating);
        review.setContent(request.getContent() != null ? request.getContent().trim() : null);

        Review saved = reviewRepository.save(review);
        User buyer = userRepository.findById(buyerId).orElse(null);

        return productMapper.toReview(saved, buyer, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public ReviewableItemDTO getReviewableItem(Long buyerId, Long orderItemId) {
        if (buyerId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }

        OrderItem item = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm trong đơn"));

        Order order = item.getOrder() != null ? item.getOrder()
                : orderRepository.findById(item.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng"));

        if (!order.getBuyerId().equals(buyerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem thông tin đơn hàng này");
        }

        Optional<Review> existingReview = reviewRepository.findByOrderItemId(item.getId());
        User seller = userRepository.findById(order.getSellerId()).orElse(null);

        return toReviewableItemDTO(order, item, seller, existingReview.orElse(null));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewableItemDTO> getReviewableItemsByOrder(Long buyerId, Long orderId) {
        if (buyerId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng"));

        if (!order.getBuyerId().equals(buyerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem thông tin đơn hàng này");
        }

        List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
        List<Long> itemIds = items.stream().map(OrderItem::getId).toList();
        Map<Long, Review> reviewMap = reviewRepository.findByOrderItemIdIn(itemIds).stream()
                .collect(Collectors.toMap(Review::getOrderItemId, Function.identity(), (a, b) -> a));

        User seller = userRepository.findById(order.getSellerId()).orElse(null);

        return items.stream()
                .map(it -> toReviewableItemDTO(order, it, seller, reviewMap.get(it.getId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewableItemDTO> getReviewableItemsByOrderCode(Long buyerId, String orderCode) {
        if (buyerId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }

        Order order = orderRepository.findByOrderCode(orderCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng với mã: " + orderCode));

        if (!order.getBuyerId().equals(buyerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem thông tin đơn hàng này");
        }

        List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
        List<Long> itemIds = items.stream().map(OrderItem::getId).toList();
        Map<Long, Review> reviewMap = reviewRepository.findByOrderItemIdIn(itemIds).stream()
                .collect(Collectors.toMap(Review::getOrderItemId, Function.identity(), (a, b) -> a));

        User seller = userRepository.findById(order.getSellerId()).orElse(null);

        return items.stream()
                .map(it -> toReviewableItemDTO(order, it, seller, reviewMap.get(it.getId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewableItemDTO> getMyReviewableItems(Long buyerId) {
        if (buyerId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }

        List<Order> orders = orderRepository.findByBuyerIdOrderByCreatedAtDesc(buyerId);
        if (orders.isEmpty()) {
            return List.of();
        }

        List<Long> orderIds = orders.stream().map(Order::getId).toList();
        List<OrderItem> allItems = orderItemRepository.findByOrderIdIn(orderIds);
        if (allItems.isEmpty()) {
            return List.of();
        }

        Map<Long, Order> orderMap = orders.stream()
                .collect(Collectors.toMap(Order::getId, Function.identity(), (a, b) -> a));

        List<Long> itemIds = allItems.stream().map(OrderItem::getId).toList();
        Map<Long, Review> reviewMap = reviewRepository.findByOrderItemIdIn(itemIds).stream()
                .collect(Collectors.toMap(Review::getOrderItemId, Function.identity(), (a, b) -> a));

        Map<Long, User> sellerMap = userRepository.findAllById(orders.stream().map(Order::getSellerId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));

        List<ReviewableItemDTO> result = new java.util.ArrayList<>();
        for (OrderItem it : allItems) {
            Order o = orderMap.get(it.getOrderId());
            if (o != null) {
                User s = sellerMap.get(o.getSellerId());
                Review r = reviewMap.get(it.getId());
                result.add(toReviewableItemDTO(o, it, s, r));
            }
        }

        // Ưu tiên đơn COMPLETED chưa đánh giá lên đầu để người dùng dễ đánh giá
        result.sort((a, b) -> {
            boolean aComp = "COMPLETED".equals(a.getOrderStatus());
            boolean bComp = "COMPLETED".equals(b.getOrderStatus());
            if (aComp != bComp) return aComp ? -1 : 1;

            if (aComp) {
                if (a.isReviewed() != b.isReviewed()) {
                    return a.isReviewed() ? 1 : -1;
                }
            }
            return Long.compare(b.getOrderId(), a.getOrderId());
        });

        return result;
    }

    private ReviewableItemDTO toReviewableItemDTO(Order order, OrderItem item, User seller, Review review) {
        boolean reviewed = review != null;
        return ReviewableItemDTO.builder()
                .orderItemId(item.getId())
                .orderId(order.getId())
                .orderCode(order.getOrderCode())
                .productId(item.getProductId())
                .productTitle(item.getProductTitle())
                .imageUrl(item.getImageUrl())
                .conditionPercent(item.getConditionPercent())
                .unitPrice(item.getUnitPrice())
                .quantity(item.getQuantity())
                .orderStatus(order.getStatus() != null ? order.getStatus().name() : null)
                .sellerId(order.getSellerId())
                .sellerName(seller != null ? seller.getFullName() : "Người bán")
                .reviewed(reviewed)
                .existingRating(reviewed ? review.getRating() : null)
                .existingProductQualityRating(reviewed ? (review.getProductQualityRating() != null ? review.getProductQualityRating() : review.getRating()) : null)
                .existingSellerAttitudeRating(reviewed ? (review.getSellerAttitudeRating() != null ? review.getSellerAttitudeRating() : review.getRating()) : null)
                .existingContent(reviewed ? review.getContent() : null)
                .existingCreatedAt(reviewed ? review.getCreatedAt() : null)
                .build();
    }
}

