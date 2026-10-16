package com.example.comicworm;

import com.example.comicworm.dto.request.CreateOrderRequest;
import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.model.*;
import com.example.comicworm.model.enums.*;
import com.example.comicworm.repository.*;
import com.example.comicworm.service.impl.OrderServiceImpl;
import com.example.comicworm.service.impl.PaymentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CodPaymentTests {

    private CheckoutBatchRepository checkoutBatchRepository;
    private OrderRepository orderRepository;
    private PaymentRepository paymentRepository;
    private PaymentAllocationRepository paymentAllocationRepository;
    private CartRepository cartRepository;
    private CartItemRepository cartItemRepository;
    private ProductRepository productRepository;
    private ProductImageRepository productImageRepository;
    private UserRepository userRepository;

    private PaymentServiceImpl paymentService;
    private OrderServiceImpl orderService;

    @BeforeEach
    void setUp() {
        checkoutBatchRepository = mock(CheckoutBatchRepository.class);
        orderRepository = mock(OrderRepository.class);
        paymentRepository = mock(PaymentRepository.class);
        paymentAllocationRepository = mock(PaymentAllocationRepository.class);
        cartRepository = mock(CartRepository.class);
        cartItemRepository = mock(CartItemRepository.class);
        productRepository = mock(ProductRepository.class);
        productImageRepository = mock(ProductImageRepository.class);
        userRepository = mock(UserRepository.class);

        paymentService = new PaymentServiceImpl(
                checkoutBatchRepository,
                orderRepository,
                paymentRepository,
                paymentAllocationRepository
        );

        orderService = new OrderServiceImpl(
                cartRepository,
                cartItemRepository,
                productRepository,
                productImageRepository,
                checkoutBatchRepository,
                orderRepository,
                orderItemRepository = mock(OrderItemRepository.class),
                userRepository
        );
    }

    private OrderItemRepository orderItemRepository;

    @Test
    @DisplayName("Đặt hàng COD: Trạng thái đơn là WAITING_CONFIRM và thanh toán là PENDING")
    void testProcessCheckoutPayment_CodMethod() {
        Long buyerId = 10L;
        String checkoutCode = "CHK-TESTCOD1";

        CheckoutBatch batch = new CheckoutBatch();
        batch.setId(100L);
        batch.setCheckoutCode(checkoutCode);
        batch.setBuyerId(buyerId);
        batch.setTotalAmount(new BigDecimal("150000.00"));

        Order order = new Order();
        order.setId(200L);
        order.setCheckoutId(batch.getId());
        order.setBuyerId(buyerId);
        order.setSellerId(5L);
        order.setTotalAmount(new BigDecimal("150000.00"));
        order.setStatus(OrderStatus.WAITING_PAYMENT);
        order.setPaymentStatus(OrderPaymentStatus.PENDING);

        when(checkoutBatchRepository.findByCheckoutCode(checkoutCode)).thenReturn(Optional.of(batch));
        when(orderRepository.findByCheckoutId(batch.getId())).thenReturn(List.of(order));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment p = invocation.getArgument(0);
            p.setId(300L);
            return p;
        });

        ProcessPaymentRequest request = new ProcessPaymentRequest();
        request.setMethod(PaymentMethod.COD);

        Map<String, Object> result = paymentService.processCheckoutPayment(checkoutCode, buyerId, request);

        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertEquals("COD", result.get("paymentMethod"));
        assertTrue(result.get("message").toString().contains("COD"));

        // Kiểm tra Payment record được tạo
        ArgumentCaptor<Payment> paymentCaptor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(paymentCaptor.capture());
        Payment savedPayment = paymentCaptor.getValue();

        assertEquals(PaymentMethod.COD, savedPayment.getMethod());
        assertEquals(PaymentStatus.PENDING, savedPayment.getStatus(), "Thanh toán COD phải ở trạng thái PENDING (chưa trả tiền)");
        assertNull(savedPayment.getPaidAt(), "paidAt phải là null khi đặt hàng COD");
        assertEquals(new BigDecimal("150000.00"), savedPayment.getAmount());

        // Kiểm tra Order record được cập nhật
        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(orderCaptor.capture());
        Order updatedOrder = orderCaptor.getValue();

        assertEquals(OrderStatus.WAITING_CONFIRM, updatedOrder.getStatus(), "Trạng thái đơn hàng phải chuyển sang WAITING_CONFIRM");
        assertEquals(OrderPaymentStatus.PENDING, updatedOrder.getPaymentStatus(), "Trạng thái thanh toán của đơn hàng COD phải là PENDING");

        // Kiểm tra phân bổ thanh toán
        verify(paymentAllocationRepository).save(any(PaymentAllocation.class));
    }

    @Test
    @DisplayName("Thanh toán trực tuyến (VIETQR): Trạng thái thanh toán là PAID và payment SUCCEEDED")
    void testProcessCheckoutPayment_OnlineMethod() {
        Long buyerId = 10L;
        String checkoutCode = "CHK-TESTQR1";

        CheckoutBatch batch = new CheckoutBatch();
        batch.setId(101L);
        batch.setCheckoutCode(checkoutCode);
        batch.setBuyerId(buyerId);
        batch.setTotalAmount(new BigDecimal("200000.00"));

        Order order = new Order();
        order.setId(201L);
        order.setCheckoutId(batch.getId());
        order.setBuyerId(buyerId);
        order.setSellerId(5L);
        order.setTotalAmount(new BigDecimal("200000.00"));
        order.setStatus(OrderStatus.WAITING_PAYMENT);
        order.setPaymentStatus(OrderPaymentStatus.PENDING);

        when(checkoutBatchRepository.findByCheckoutCode(checkoutCode)).thenReturn(Optional.of(batch));
        when(orderRepository.findByCheckoutId(batch.getId())).thenReturn(List.of(order));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment p = invocation.getArgument(0);
            p.setId(301L);
            return p;
        });

        ProcessPaymentRequest request = new ProcessPaymentRequest();
        request.setMethod(PaymentMethod.VIETQR);

        Map<String, Object> result = paymentService.processCheckoutPayment(checkoutCode, buyerId, request);

        assertTrue((Boolean) result.get("success"));

        ArgumentCaptor<Payment> paymentCaptor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(paymentCaptor.capture());
        Payment savedPayment = paymentCaptor.getValue();

        assertEquals(PaymentMethod.VIETQR, savedPayment.getMethod());
        assertEquals(PaymentStatus.SUCCEEDED, savedPayment.getStatus());
        assertNotNull(savedPayment.getPaidAt());

        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(orderCaptor.capture());
        Order updatedOrder = orderCaptor.getValue();

        assertEquals(OrderStatus.WAITING_CONFIRM, updatedOrder.getStatus());
        assertEquals(OrderPaymentStatus.PAID, updatedOrder.getPaymentStatus());
    }

    @Test
    @DisplayName("Quy trình tạo đơn từ giỏ hàng cho người mua rồi xác nhận COD")
    void testFullCartCheckoutToCodPaymentFlow() {
        Long buyerId = 1L;
        Long sellerId = 2L;

        Cart cart = new Cart();
        cart.setId(10L);
        cart.setUserId(buyerId);

        CartItem item = new CartItem();
        item.setId(20L);
        item.setCartId(10L);
        item.setProductId(100L);
        item.setQuantity(2);
        item.setIsSelected(true);

        Product product = new Product();
        product.setId(100L);
        product.setSellerId(sellerId);
        product.setTitle("Thám Tử Lừng Danh Conan Tập 100");
        product.setPrice(new BigDecimal("35000.00"));
        product.setStockQuantity(10);
        product.setConditionPercent(99);

        when(cartRepository.findByUserId(buyerId)).thenReturn(Optional.of(cart));
        when(cartItemRepository.findByCartIdAndIsSelectedTrue(10L)).thenReturn(List.of(item));
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(checkoutBatchRepository.save(any(CheckoutBatch.class))).thenAnswer(inv -> {
            CheckoutBatch b = inv.getArgument(0);
            b.setId(500L);
            return b;
        });
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(600L);
            return o;
        });

        CreateOrderRequest orderReq = new CreateOrderRequest();
        orderReq.setRecipientName("Nguyễn Văn A");
        orderReq.setRecipientPhone("0987654321");
        orderReq.setShippingAddress("123 Phố Huế, Hai Bà Trưng, Hà Nội");
        orderReq.setBuyerNote("Kiểm tra hàng trước khi nhận");

        String checkoutCode = orderService.createOrderFromCart(buyerId, orderReq);
        assertNotNull(checkoutCode);
        assertTrue(checkoutCode.startsWith("CHK-"));

        // Kiểm tra trừ kho
        assertEquals(8, product.getStockQuantity(), "Tồn kho phải giảm từ 10 xuống 8");

        // Giả lập tiếp tục bước thanh toán COD
        CheckoutBatch createdBatch = new CheckoutBatch();
        createdBatch.setId(500L);
        createdBatch.setCheckoutCode(checkoutCode);
        createdBatch.setBuyerId(buyerId);
        createdBatch.setTotalAmount(new BigDecimal("100000.00")); // 70k sách + 30k ship

        Order createdOrder = new Order();
        createdOrder.setId(600L);
        createdOrder.setCheckoutId(500L);
        createdOrder.setBuyerId(buyerId);
        createdOrder.setSellerId(sellerId);
        createdOrder.setStatus(OrderStatus.WAITING_PAYMENT);
        createdOrder.setPaymentStatus(OrderPaymentStatus.PENDING);
        createdOrder.setTotalAmount(new BigDecimal("100000.00"));

        when(checkoutBatchRepository.findByCheckoutCode(checkoutCode)).thenReturn(Optional.of(createdBatch));
        when(orderRepository.findByCheckoutId(500L)).thenReturn(List.of(createdOrder));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        ProcessPaymentRequest payReq = new ProcessPaymentRequest();
        payReq.setMethod(PaymentMethod.COD);

        Map<String, Object> payResult = paymentService.processCheckoutPayment(checkoutCode, buyerId, payReq);
        assertTrue((Boolean) payResult.get("success"));
        assertEquals("COD", payResult.get("paymentMethod"));

        assertEquals(OrderStatus.WAITING_CONFIRM, createdOrder.getStatus());
        assertEquals(OrderPaymentStatus.PENDING, createdOrder.getPaymentStatus());
    }
}
