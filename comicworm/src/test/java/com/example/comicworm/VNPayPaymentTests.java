package com.example.comicworm;

import com.example.comicworm.config.VNPayConfig;
import com.example.comicworm.controller.PaymentController;
import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.dto.response.VNPayCallbackResultDTO;
import com.example.comicworm.model.CheckoutBatch;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.Payment;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.PaymentMethod;
import com.example.comicworm.model.enums.PaymentStatus;
import com.example.comicworm.repository.CheckoutBatchRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.PaymentAllocationRepository;
import com.example.comicworm.repository.PaymentRepository;
import com.example.comicworm.service.IOrderService;
import com.example.comicworm.service.OrderStatusService;
import com.example.comicworm.service.impl.PaymentServiceImpl;
import com.example.comicworm.utils.VNPayUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class VNPayPaymentTests {

    private CheckoutBatchRepository checkoutBatchRepository;
    private OrderRepository orderRepository;
    private PaymentRepository paymentRepository;
    private PaymentAllocationRepository paymentAllocationRepository;
    private OrderStatusService orderStatusService;
    private VNPayConfig vnPayConfig;
    private PaymentServiceImpl paymentService;

    private final String TMN_CODE = "9YVV8BC4";
    private final String HASH_SECRET = "XPHATXU5O4UCWCA5QW2V52NH55U5UG3B";
    private final String PAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    private final String RETURN_URL = "http://localhost:8080/api/checkout/vnpay-return";

    @BeforeEach
    void setUp() {
        checkoutBatchRepository = mock(CheckoutBatchRepository.class);
        orderRepository = mock(OrderRepository.class);
        paymentRepository = mock(PaymentRepository.class);
        paymentAllocationRepository = mock(PaymentAllocationRepository.class);
        orderStatusService = mock(OrderStatusService.class);

        vnPayConfig = mock(VNPayConfig.class);
        when(vnPayConfig.getTmnCode()).thenReturn(TMN_CODE);
        when(vnPayConfig.getHashSecret()).thenReturn(HASH_SECRET);
        when(vnPayConfig.getPayUrl()).thenReturn(PAY_URL);
        when(vnPayConfig.getReturnUrl()).thenReturn(RETURN_URL);

        when(orderRepository.findByCheckoutIdForUpdate(anyLong())).thenAnswer(invocation ->
                orderRepository.findByCheckoutId(invocation.getArgument(0)));

        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment p = invocation.getArgument(0);
            if (p.getId() == null) p.setId(99L);
            return p;
        });

        paymentService = new PaymentServiceImpl(
                checkoutBatchRepository,
                orderRepository,
                paymentRepository,
                paymentAllocationRepository,
                vnPayConfig
        );
        paymentService.setOrderStatusService(orderStatusService);
    }

    @Test
    @DisplayName("Khởi tạo thanh toán VNPay: Tạo URL hợp lệ và mã checksum chính xác")
    void testCreateVNPayPaymentUrl_GeneratesValidUrlAndChecksum() {
        CheckoutBatch batch = new CheckoutBatch();
        batch.setId(10L);
        batch.setCheckoutCode("CHUB-TEST-001");
        batch.setBuyerId(1L);
        batch.setTotalAmount(new BigDecimal("250000.00"));
        batch.setExpiresAt(LocalDateTime.now().plusHours(1));

        Order order = new Order();
        order.setId(101L);
        order.setCheckoutId(10L);
        order.setBuyerId(1L);
        order.setSellerId(2L);
        order.setStatus(OrderStatus.WAITING_PAYMENT);
        order.setTotalAmount(new BigDecimal("250000.00"));

        when(checkoutBatchRepository.findByCheckoutCode("CHUB-TEST-001")).thenReturn(Optional.of(batch));
        when(orderRepository.findByCheckoutId(10L)).thenReturn(List.of(order));

        HttpServletRequest mockRequest = new MockHttpServletRequest();

        ProcessPaymentRequest request = new ProcessPaymentRequest(PaymentMethod.VNPAY);
        Map<String, Object> result = paymentService.processCheckoutPayment("CHUB-TEST-001", 1L, request, mockRequest);

        assertNotNull(result);
        assertTrue((Boolean) result.get("success"));
        assertEquals("VNPAY", result.get("paymentMethod"));
        assertNotNull(result.get("paymentUrl"));
        String paymentUrl = (String) result.get("paymentUrl");

        assertTrue(paymentUrl.startsWith(PAY_URL));
        assertTrue(paymentUrl.contains("vnp_TmnCode=" + TMN_CODE));
        assertTrue(paymentUrl.contains("vnp_Amount=25000000")); // 250,000 * 100
        assertTrue(paymentUrl.contains("vnp_SecureHash="));

        // Phân tích tham số từ paymentUrl và kiểm tra tính hợp lệ của chữ ký
        URI uri = URI.create(paymentUrl);
        String query = uri.getQuery();
        Map<String, String> queryParams = new HashMap<>();
        for (String param : query.split("&")) {
            String[] pair = param.split("=");
            queryParams.put(pair[0], pair.length > 1 ? URLDecoder.decode(pair[1], StandardCharsets.UTF_8) : "");
        }

        assertTrue(VNPayUtil.verifySignature(queryParams, HASH_SECRET), "Chữ ký VNPay phải hợp lệ với secret key");
    }

    @Test
    @DisplayName("Callback VNPay thành công (00): Cập nhật Payment sang SUCCEEDED và Order sang WAITING_CONFIRM")
    void testProcessVNPayCallback_Success_UpdatesPaymentAndOrders() {
        CheckoutBatch batch = new CheckoutBatch();
        batch.setId(20L);
        batch.setCheckoutCode("CHUB-SUCCESS-123");
        batch.setBuyerId(2L);

        Payment payment = new Payment();
        payment.setId(200L);
        payment.setCheckoutId(20L);
        payment.setPaymentCode("PAY-TESTVNP01");
        payment.setMethod(PaymentMethod.VNPAY);
        payment.setStatus(PaymentStatus.PENDING);

        Order order = new Order();
        order.setId(201L);
        order.setCheckoutId(20L);
        order.setBuyerId(2L);
        order.setStatus(OrderStatus.WAITING_PAYMENT);
        order.setPaymentStatus(OrderPaymentStatus.PENDING);

        when(paymentRepository.findByPaymentCode("PAY-TESTVNP01")).thenReturn(Optional.of(payment));
        when(checkoutBatchRepository.findById(20L)).thenReturn(Optional.of(batch));
        when(orderRepository.findByCheckoutId(20L)).thenReturn(List.of(order));

        // Chuẩn bị các tham số giả lập từ VNPay
        Map<String, String> params = new HashMap<>();
        params.put("vnp_Amount", "10000000");
        params.put("vnp_BankCode", "NCB");
        params.put("vnp_BankTranNo", "VNP12345678");
        params.put("vnp_CardType", "ATM");
        params.put("vnp_OrderInfo", "Thanh toan don hang CHUB-SUCCESS-123");
        params.put("vnp_PayDate", "20261020200000");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TmnCode", TMN_CODE);
        params.put("vnp_TransactionNo", "14890001");
        params.put("vnp_TransactionStatus", "00");
        params.put("vnp_TxnRef", "PAY-TESTVNP01");

        // Tạo chữ ký hợp lệ
        List<String> fieldNames = new ArrayList<>(params.keySet());
        Collections.sort(fieldNames);
        StringBuilder hashData = new StringBuilder();
        for (String f : fieldNames) {
            if (hashData.length() > 0) hashData.append('&');
            hashData.append(f).append('=').append(java.net.URLEncoder.encode(params.get(f), StandardCharsets.US_ASCII));
        }
        String secureHash = VNPayUtil.hmacSHA512(HASH_SECRET, hashData.toString());
        params.put("vnp_SecureHash", secureHash);

        VNPayCallbackResultDTO result = paymentService.processVNPayCallback(params);

        assertTrue(result.isSuccess());
        assertEquals("CHUB-SUCCESS-123", result.getCheckoutCode());
        assertEquals("PAY-TESTVNP01", result.getPaymentCode());
        assertEquals(PaymentStatus.SUCCEEDED, payment.getStatus());
        assertEquals("14890001", payment.getProviderTransactionId());
        assertEquals(OrderStatus.WAITING_CONFIRM, order.getStatus());
        assertEquals(OrderPaymentStatus.PAID, order.getPaymentStatus());
    }

    @Test
    @DisplayName("Callback VNPay thất bại hoặc bị hủy (24): Cập nhật Payment sang CANCELLED")
    void testProcessVNPayCallback_Cancelled_UpdatesPaymentStatus() {
        CheckoutBatch batch = new CheckoutBatch();
        batch.setId(30L);
        batch.setCheckoutCode("CHUB-CANCEL-456");
        batch.setBuyerId(3L);

        Payment payment = new Payment();
        payment.setId(300L);
        payment.setCheckoutId(30L);
        payment.setPaymentCode("PAY-CANCEL01");
        payment.setMethod(PaymentMethod.VNPAY);
        payment.setStatus(PaymentStatus.PENDING);

        when(paymentRepository.findByPaymentCode("PAY-CANCEL01")).thenReturn(Optional.of(payment));
        when(checkoutBatchRepository.findById(30L)).thenReturn(Optional.of(batch));

        Map<String, String> params = new HashMap<>();
        params.put("vnp_Amount", "5000000");
        params.put("vnp_ResponseCode", "24"); // Khách hàng hủy giao dịch
        params.put("vnp_TransactionStatus", "02");
        params.put("vnp_TxnRef", "PAY-CANCEL01");
        params.put("vnp_TmnCode", TMN_CODE);

        List<String> fieldNames = new ArrayList<>(params.keySet());
        Collections.sort(fieldNames);
        StringBuilder hashData = new StringBuilder();
        for (String f : fieldNames) {
            if (hashData.length() > 0) hashData.append('&');
            hashData.append(f).append('=').append(java.net.URLEncoder.encode(params.get(f), StandardCharsets.US_ASCII));
        }
        String secureHash = VNPayUtil.hmacSHA512(HASH_SECRET, hashData.toString());
        params.put("vnp_SecureHash", secureHash);

        VNPayCallbackResultDTO result = paymentService.processVNPayCallback(params);

        assertFalse(result.isSuccess());
        assertEquals(PaymentStatus.CANCELLED, payment.getStatus());
        assertTrue(result.getMessage().contains("bị hủy"));
    }

    @Test
    @DisplayName("Callback VNPay có chữ ký không hợp lệ: Từ chối xử lý")
    void testProcessVNPayCallback_InvalidSignature_ReturnsFailure() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TxnRef", "PAY-FAKE");
        params.put("vnp_SecureHash", "INVALIDSIGNATURE1234567890ABCDEF");

        VNPayCallbackResultDTO result = paymentService.processVNPayCallback(params);

        assertFalse(result.isSuccess());
        assertEquals("Chữ ký bảo mật VNPay không hợp lệ", result.getMessage());
    }

    @Test
    @DisplayName("PaymentController: Thành công chuyển hướng đến page3.html (trạng thái đơn hàng)")
    void testPaymentController_ReturnSuccess_RedirectsToPage3() throws Exception {
        IOrderService orderService = mock(IOrderService.class);
        PaymentController controller = new PaymentController(orderService, paymentService);

        VNPayCallbackResultDTO mockSuccessResult = VNPayCallbackResultDTO.builder()
                .success(true)
                .checkoutCode("CHUB-TEST-999")
                .paymentCode("PAY-TEST-999")
                .build();

        PaymentServiceImpl spyPaymentService = spy(paymentService);
        doReturn(mockSuccessResult).when(spyPaymentService).processVNPayCallback(any());

        PaymentController testController = new PaymentController(orderService, spyPaymentService);

        MockHttpServletResponse response = new MockHttpServletResponse();
        testController.vnpayReturn(Map.of("vnp_ResponseCode", "00"), response);

        assertEquals(302, response.getStatus());
        String redirectedUrl = response.getRedirectedUrl();
        assertNotNull(redirectedUrl);
        assertTrue(redirectedUrl.startsWith("/buyer/html/page3.html"), "Phải chuyển hướng đến page3.html");
        assertTrue(redirectedUrl.contains("paymentSuccess=true"));
        assertTrue(redirectedUrl.contains("checkoutCode=CHUB-TEST-999"));
    }

    @Test
    @DisplayName("PaymentController: Thất bại chuyển hướng quay lại payment.html (trang thanh toán)")
    void testPaymentController_ReturnFailure_RedirectsToPayment() throws Exception {
        IOrderService orderService = mock(IOrderService.class);

        VNPayCallbackResultDTO mockFailResult = VNPayCallbackResultDTO.builder()
                .success(false)
                .checkoutCode("CHUB-FAIL-888")
                .paymentCode("PAY-FAIL-888")
                .responseCode("24")
                .message("Giao dịch đã bị hủy bởi người dùng.")
                .build();

        PaymentServiceImpl spyPaymentService = spy(paymentService);
        doReturn(mockFailResult).when(spyPaymentService).processVNPayCallback(any());

        PaymentController testController = new PaymentController(orderService, spyPaymentService);

        MockHttpServletResponse response = new MockHttpServletResponse();
        testController.vnpayReturn(Map.of("vnp_ResponseCode", "24"), response);

        assertEquals(302, response.getStatus());
        String redirectedUrl = response.getRedirectedUrl();
        assertNotNull(redirectedUrl);
        assertTrue(redirectedUrl.startsWith("/buyer/html/payment.html"), "Phải chuyển hướng quay lại payment.html");
        assertTrue(redirectedUrl.contains("paymentError="));
        assertTrue(redirectedUrl.contains("checkoutCode=CHUB-FAIL-888"));
    }
}
