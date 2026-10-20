package com.example.comicworm;

import com.example.comicworm.dto.request.CreateOrderRequest;
import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.model.*;
import com.example.comicworm.model.enums.*;
import com.example.comicworm.repository.*;
import com.example.comicworm.service.IOrderService;
import com.example.comicworm.service.IPaymentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class CodOrderMySqlIntegrationTests {

    @Autowired
    private IOrderService orderService;

    @Autowired
    private IPaymentService paymentService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CartRepository cartRepository;

    @Autowired
    private CartItemRepository cartItemRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private CheckoutBatchRepository checkoutBatchRepository;

    @Autowired
    private PaymentAllocationRepository paymentAllocationRepository;

    @Test
    @DisplayName("Kiểm thử tích hợp MySQL: Mua hàng COD từ giỏ hàng, lưu DB với Payment COD PENDING và Order WAITING_CONFIRM")
    void testCodPurchaseDatabaseIntegration() {
        // 1. Tạo buyer và seller test
        String buyerEmail = "cod-buyer-" + UUID.randomUUID().toString().substring(0, 8) + "@comicworm.invalid";
        String sellerEmail = "cod-seller-" + UUID.randomUUID().toString().substring(0, 8) + "@comicworm.invalid";

        User buyer = new User();
        buyer.setEmail(buyerEmail);
        buyer.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz1234567890");
        buyer.setFullName("Buyer Test COD");
        buyer.setRole(UserRole.USER);
        buyer.setAccountStatus(AccountStatus.ACTIVE);
        buyer = userRepository.save(buyer);

        User seller = new User();
        seller.setEmail(sellerEmail);
        seller.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz1234567890");
        seller.setFullName("Seller Test COD");
        seller.setRole(UserRole.USER);
        seller.setAccountStatus(AccountStatus.ACTIVE);
        seller.setIsSeller(true);
        seller = userRepository.save(seller);

        // 2. Lấy category hoặc tạo mới
        Category category = categoryRepository.findAll().stream().findFirst().orElseGet(() -> {
            Category c = new Category();
            c.setName("Manga Shonen");
            c.setSlug("manga-shonen-" + UUID.randomUUID().toString().substring(0, 8));
            return categoryRepository.save(c);
        });

        // 3. Tạo product test
        Product product = new Product();
        product.setSellerId(seller.getId());
        product.setTitle("One Piece Tập 100 - Bản Sưu Tầm");
        product.setSlug("one-piece-100-" + UUID.randomUUID().toString().substring(0, 8));
        product.setDescription("Bản sưu tầm đặc biệt có kèm obi và bookmark");
        product.setCategoryId(category.getId());
        product.setPrice(new BigDecimal("80000.00"));
        product.setStockQuantity(10);
        product.setConditionPercent(98);
        product.setListingType(ListingType.SELL);
        product.setModerationStatus(ModerationStatus.APPROVED);
        product = productRepository.save(product);

        // 3. Tạo giỏ hàng và thêm sản phẩm
        Cart cart = new Cart();
        cart.setUserId(buyer.getId());
        cart = cartRepository.save(cart);

        CartItem item = new CartItem();
        item.setCartId(cart.getId());
        item.setProductId(product.getId());
        item.setQuantity(2);
        item.setIsSelected(true);
        cartItemRepository.save(item);

        // 4. Tạo đơn hàng từ giỏ (Checkout)
        CreateOrderRequest orderReq = new CreateOrderRequest();
        orderReq.setRecipientName("Lê Văn Test");
        orderReq.setRecipientPhone("0981234567");
        orderReq.setShippingAddress("123 Phố Sách, Hà Nội");
        orderReq.setBuyerNote("Giao giờ hành chính, đồng kiểm bọc sách");

        String checkoutCode = orderService.createOrderFromCart(buyer.getId(), orderReq);
        assertNotNull(checkoutCode, "Phải sinh được checkoutCode");

        // Kiểm tra trừ kho
        Product refreshedProduct = productRepository.findById(product.getId()).orElseThrow();
        assertEquals(8, refreshedProduct.getStockQuantity(), "Tồn kho phải được trừ 2 cuốn");

        // Kiểm tra giỏ hàng đã được làm trống
        List<CartItem> remainingItems = cartItemRepository.findByCartIdAndIsSelectedTrue(cart.getId());
        assertTrue(remainingItems.isEmpty(), "Mục đã checkout phải được xóa khỏi giỏ");

        // 5. Thanh toán với phương thức COD
        ProcessPaymentRequest payReq = new ProcessPaymentRequest();
        payReq.setMethod(PaymentMethod.COD);

        Map<String, Object> payRes = paymentService.processCheckoutPayment(checkoutCode, buyer.getId(), payReq);
        assertNotNull(payRes);
        assertTrue((Boolean) payRes.get("success"), "Xác nhận COD phải thành công");
        assertEquals("COD", payRes.get("paymentMethod"));

        // 6. Kiểm tra các bản ghi trong MySQL Database
        CheckoutBatch batch = checkoutBatchRepository.findByCheckoutCode(checkoutCode).orElseThrow();
        List<Order> orders = orderRepository.findByCheckoutId(batch.getId());
        assertEquals(1, orders.size(), "Phải có đúng 1 đơn hàng cho 1 seller");

        Order savedOrder = orders.get(0);
        assertEquals(OrderStatus.WAITING_CONFIRM, savedOrder.getStatus(),
                "Trạng thái đơn hàng COD phải là WAITING_CONFIRM (chờ người bán chuẩn bị hàng)");
        assertEquals(OrderPaymentStatus.PENDING, savedOrder.getPaymentStatus(),
                "Trạng thái thanh toán của đơn COD phải là PENDING (chưa trả tiền)");
        assertEquals(new BigDecimal("190000.00"), savedOrder.getTotalAmount(),
                "Tổng tiền: 2 x 80.000 + 30.000 ship = 190.000đ");

        // Kiểm tra Payment record
        List<Payment> payments = paymentRepository.findAll();
        Payment codPayment = payments.stream()
                .filter(p -> p.getCheckoutId().equals(batch.getId()))
                .findFirst()
                .orElse(null);

        assertNotNull(codPayment, "Phải lưu được bản ghi Payment vào bảng payments trong MySQL");
        assertEquals(PaymentMethod.COD, codPayment.getMethod(), "Phương thức thanh toán phải là COD");
        assertEquals(PaymentStatus.PENDING, codPayment.getStatus(), "Trạng thái thanh toán COD phải là PENDING");
        assertNull(codPayment.getPaidAt(), "paidAt phải là null vì khách chưa thanh toán");
        assertEquals(new BigDecimal("190000.00"), codPayment.getAmount());

        // Kiểm tra PaymentAllocation
        List<PaymentAllocation> allocations = paymentAllocationRepository.findAll();
        boolean hasAllocation = allocations.stream()
                .anyMatch(a -> a.getPaymentId().equals(codPayment.getId()) && a.getOrderId().equals(savedOrder.getId()));
        assertTrue(hasAllocation, "Phải có payment allocation liên kết giữa payment và order");
    }
}
