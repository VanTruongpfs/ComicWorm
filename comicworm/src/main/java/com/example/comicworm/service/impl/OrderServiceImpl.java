package com.example.comicworm.service.impl;

import com.example.comicworm.dto.request.CreateOrderRequest;
import com.example.comicworm.dto.response.CheckoutSummaryDTO;
import com.example.comicworm.model.*;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.*;
import com.example.comicworm.service.IOrderService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OrderServiceImpl implements IOrderService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;
    private final CheckoutBatchRepository checkoutBatchRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final UserRepository userRepository;

    public OrderServiceImpl(
            CartRepository cartRepository,
            CartItemRepository cartItemRepository,
            ProductRepository productRepository,
            ProductImageRepository productImageRepository,
            CheckoutBatchRepository checkoutBatchRepository,
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            UserRepository userRepository) {
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.productRepository = productRepository;
        this.productImageRepository = productImageRepository;
        this.checkoutBatchRepository = checkoutBatchRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public String createOrderFromCart(Long buyerId, CreateOrderRequest request) {
        Cart cart = cartRepository.findByUserId(buyerId)
                .orElseThrow(() -> new IllegalStateException("Giỏ hàng không tồn tại"));

        List<CartItem> selectedItems = cartItemRepository.findByCartIdAndIsSelectedTrue(cart.getId());
        if (selectedItems.isEmpty()) {
            throw new IllegalStateException("Chưa chọn sản phẩm nào để thanh toán");
        }

        // Lấy danh sách sản phẩm và kiểm tra tồn kho
        Map<Long, Product> productMap = new HashMap<>();
        BigDecimal totalBatchAmount = BigDecimal.ZERO;

        for (CartItem item : selectedItems) {
            Product p = productRepository.findById(item.getProductId())
                    .orElseThrow(() -> new IllegalArgumentException("Sản phẩm không tồn tại: ID " + item.getProductId()));

            if (p.getSellerId().equals(buyerId)) {
                throw new IllegalStateException("Bạn không thể mua sản phẩm '" + p.getTitle() + "' do chính mình đăng bán");
            }

            if (p.getStockQuantity() < item.getQuantity()) {
                throw new IllegalStateException("Sản phẩm '" + p.getTitle() + "' không còn đủ số lượng trong kho (còn " + p.getStockQuantity() + ")");
            }
            productMap.put(p.getId(), p);
            totalBatchAmount = totalBatchAmount.add(p.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
        }

        // 1. Tạo Checkout Batch
        String checkoutCode = "CHK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        CheckoutBatch batch = new CheckoutBatch();
        batch.setCheckoutCode(checkoutCode);
        batch.setBuyerId(buyerId);
        batch.setIdempotencyKey(UUID.randomUUID().toString());
        batch.setTotalAmount(totalBatchAmount);
        batch.setExpiresAt(LocalDateTime.now().plusHours(24));
        batch = checkoutBatchRepository.save(batch);

        // 2. Nhóm sản phẩm theo từng người bán (Seller)
        Map<Long, List<CartItem>> itemsBySeller = selectedItems.stream()
                .collect(Collectors.groupingBy(item -> productMap.get(item.getProductId()).getSellerId()));

        BigDecimal totalBatchWithShipping = BigDecimal.ZERO;

        for (Map.Entry<Long, List<CartItem>> entry : itemsBySeller.entrySet()) {
            Long sellerId = entry.getKey();
            List<CartItem> sellerItems = entry.getValue();

            BigDecimal subtotal = sellerItems.stream()
                    .map(it -> productMap.get(it.getProductId()).getPrice().multiply(BigDecimal.valueOf(it.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal shippingFee = new BigDecimal("30000"); // Phí ship mặc định 30.000đ mỗi shop
            BigDecimal totalOrderAmount = subtotal.add(shippingFee);
            totalBatchWithShipping = totalBatchWithShipping.add(totalOrderAmount);

            Order order = new Order();
            order.setOrderCode("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            order.setCheckoutId(batch.getId());
            order.setBuyerId(buyerId);
            order.setSellerId(sellerId);
            order.setSubtotalAmount(subtotal);
            order.setShippingFee(shippingFee);
            order.setTotalAmount(totalOrderAmount);
            order.setRecipientName(request.getRecipientName());
            order.setRecipientPhone(request.getRecipientPhone());
            order.setShippingAddress(request.getShippingAddress());
            order.setBuyerNote(request.getBuyerNote());
            order.setStatus(OrderStatus.WAITING_PAYMENT);
            order.setPaymentStatus(OrderPaymentStatus.PENDING);

            order = orderRepository.save(order);

            // 3. Tạo Order Items & trừ kho
            for (CartItem ci : sellerItems) {
                Product p = productMap.get(ci.getProductId());
                String imageUrl = productImageRepository.findFirstByProductIdOrderByDisplayOrderAsc(p.getId())
                        .map(ProductImage::getImageUrl)
                        .orElse(null);

                OrderItem orderItem = new OrderItem();
                orderItem.setOrderId(order.getId());
                orderItem.setProductId(p.getId());
                orderItem.setProductTitle(p.getTitle());
                orderItem.setImageUrl(imageUrl);
                orderItem.setConditionPercent(p.getConditionPercent());
                orderItem.setUnitPrice(p.getPrice());
                orderItem.setQuantity(ci.getQuantity());

                orderItemRepository.save(orderItem);

                // Cập nhật lại kho
                p.setStockQuantity(p.getStockQuantity() - ci.getQuantity());
                productRepository.save(p);
            }
        }

        // Cập nhật tổng tiền CheckoutBatch bao gồm cả tiền ship
        batch.setTotalAmount(totalBatchWithShipping);
        checkoutBatchRepository.save(batch);

        // 4. Xóa các mục đã checkout khỏi giỏ
        cartItemRepository.deleteAll(selectedItems);

        return checkoutCode;
    }

    @Override
    @Transactional(readOnly = true)
    public CheckoutSummaryDTO getCheckoutSummary(String checkoutCode, Long buyerId) {
        CheckoutBatch batch = checkoutBatchRepository.findByCheckoutCode(checkoutCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đợt đặt hàng với mã: " + checkoutCode));

        if (buyerId != null && !batch.getBuyerId().equals(buyerId)) {
            throw new IllegalStateException("Bạn không có quyền xem thông tin đợt đặt hàng này");
        }

        List<Order> orders = orderRepository.findByCheckoutId(batch.getId());
        String recipientName = "";
        String recipientPhone = "";
        String shippingAddress = "";
        String buyerNote = "";

        if (!orders.isEmpty()) {
            Order firstOrder = orders.get(0);
            recipientName = firstOrder.getRecipientName();
            recipientPhone = firstOrder.getRecipientPhone();
            shippingAddress = firstOrder.getShippingAddress();
            buyerNote = firstOrder.getBuyerNote();
        }

        List<CheckoutSummaryDTO.CheckoutOrderDTO> orderDTOs = orders.stream().map(order -> {
            String sellerName = userRepository.findById(order.getSellerId())
                    .map(User::getFullName)
                    .orElse("Người bán");

            List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
            List<CheckoutSummaryDTO.CheckoutOrderItemDTO> itemDTOs = items.stream().map(it ->
                    CheckoutSummaryDTO.CheckoutOrderItemDTO.builder()
                            .productId(it.getProductId())
                            .productTitle(it.getProductTitle())
                            .unitPrice(it.getUnitPrice())
                            .quantity(it.getQuantity())
                            .conditionPercent(it.getConditionPercent())
                            .imageUrl(it.getImageUrl())
                            .build()
            ).toList();

            return CheckoutSummaryDTO.CheckoutOrderDTO.builder()
                    .orderCode(order.getOrderCode())
                    .sellerId(order.getSellerId())
                    .sellerName(sellerName)
                    .subtotalAmount(order.getSubtotalAmount())
                    .shippingFee(order.getShippingFee())
                    .totalAmount(order.getTotalAmount())
                    .status(order.getStatus() != null ? order.getStatus().name() : "WAITING_PAYMENT")
                    .items(itemDTOs)
                    .build();
        }).toList();

        return CheckoutSummaryDTO.builder()
                .checkoutCode(batch.getCheckoutCode())
                .buyerId(batch.getBuyerId())
                .totalAmount(batch.getTotalAmount())
                .expiresAt(batch.getExpiresAt())
                .recipientName(recipientName)
                .recipientPhone(recipientPhone)
                .shippingAddress(shippingAddress)
                .buyerNote(buyerNote)
                .orders(orderDTOs)
                .build();
    }
}