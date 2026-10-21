package com.example.comicworm.service.impl;

import com.example.comicworm.config.VNPayConfig;
import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.dto.response.VNPayCallbackResultDTO;
import com.example.comicworm.model.CheckoutBatch;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.Payment;
import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.PaymentStatus;
import com.example.comicworm.repository.CheckoutBatchRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.PaymentAllocationRepository;
import com.example.comicworm.repository.PaymentRepository;
import com.example.comicworm.service.IPaymentService;
import com.example.comicworm.service.OrderStatusService;
import com.example.comicworm.utils.VNPayUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class PaymentServiceImpl implements IPaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentServiceImpl.class);

    private final CheckoutBatchRepository checkoutBatchRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentAllocationRepository paymentAllocationRepository;
    private final VNPayConfig vnPayConfig;
    private OrderStatusService orderStatusService;

    public PaymentServiceImpl(
            CheckoutBatchRepository checkoutBatchRepository,
            OrderRepository orderRepository,
            PaymentRepository paymentRepository,
            PaymentAllocationRepository paymentAllocationRepository) {
        this(checkoutBatchRepository, orderRepository, paymentRepository, paymentAllocationRepository, new VNPayConfig());
    }

    @Autowired
    public PaymentServiceImpl(
            CheckoutBatchRepository checkoutBatchRepository,
            OrderRepository orderRepository,
            PaymentRepository paymentRepository,
            PaymentAllocationRepository paymentAllocationRepository,
            VNPayConfig vnPayConfig) {
        this.checkoutBatchRepository = checkoutBatchRepository;
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
        this.paymentAllocationRepository = paymentAllocationRepository;
        this.vnPayConfig = vnPayConfig != null ? vnPayConfig : new VNPayConfig();
    }

    @Autowired
    public void setOrderStatusService(OrderStatusService orderStatusService) {
        this.orderStatusService = orderStatusService;
    }

    @Override
    @Transactional
    public Map<String, Object> processCheckoutPayment(String checkoutCode, Long buyerId, ProcessPaymentRequest request, HttpServletRequest httpRequest) {
        CheckoutBatch batch = checkoutBatchRepository.findByCheckoutCode(checkoutCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đợt checkout: " + checkoutCode));

        if (!batch.getBuyerId().equals(buyerId)) {
            throw new IllegalStateException("Bạn không có quyền thanh toán đợt hàng này");
        }

        List<Order> lockedOrders = orderRepository.findByCheckoutIdForUpdate(batch.getId());
        if (!batch.getExpiresAt().isAfter(LocalDateTime.now())
                || lockedOrders.stream().anyMatch(order -> order.getStatus() != OrderStatus.WAITING_PAYMENT)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đơn hàng đã hết hạn hoặc đã bị hủy");
        }

        List<Order> orders = orderRepository.findByCheckoutId(batch.getId());
        if (orders.isEmpty()) {
            throw new IllegalStateException("Đợt thanh toán không có đơn hàng nào");
        }

        boolean alreadyProcessed = orders.stream().allMatch(o -> o.getStatus() != OrderStatus.WAITING_PAYMENT);
        if (alreadyProcessed) {
            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("message", "Đợt hàng này đã được xác nhận đặt hàng trước đó");
            res.put("checkoutCode", checkoutCode);
            return res;
        }

        com.example.comicworm.model.enums.PaymentMethod method = (request != null && request.getMethod() != null)
                ? request.getMethod()
                : com.example.comicworm.model.enums.PaymentMethod.VNPAY;
        boolean isCod = (method == com.example.comicworm.model.enums.PaymentMethod.COD);
        boolean isVnPay = (method == com.example.comicworm.model.enums.PaymentMethod.VNPAY);

        Payment payment = new Payment();
        payment.setCheckoutId(batch.getId());
        payment.setPaymentCode("PAY-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase());
        payment.setMethod(method);
        payment.setStatus((isCod || isVnPay) ? PaymentStatus.PENDING : PaymentStatus.SUCCEEDED);
        payment.setAmount(batch.getTotalAmount());
        payment.setIdempotencyKey(UUID.randomUUID().toString());
        payment.setPaidAt((isCod || isVnPay) ? null : LocalDateTime.now());
        Payment savedPayment = paymentRepository.save(payment);

        for (Order order : orders) {
            PaymentAllocation allocation = new PaymentAllocation();
            allocation.setPaymentId(savedPayment.getId());
            allocation.setOrderId(order.getId());
            allocation.setAmount(order.getTotalAmount());
            paymentAllocationRepository.save(allocation);

            if (!isVnPay) {
                order.setStatus(OrderStatus.WAITING_CONFIRM);
                order.setPaymentStatus(isCod ? OrderPaymentStatus.PENDING : OrderPaymentStatus.PAID);
                orderRepository.save(order);
                orderStatusService.recordHistory(order, OrderStatus.WAITING_PAYMENT, buyerId, "Thanh toán " + method);
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("paymentCode", savedPayment.getPaymentCode());
        res.put("checkoutCode", checkoutCode);
        res.put("paymentMethod", method.name());

        if (isVnPay) {
            String paymentUrl = createVNPayPaymentUrl(savedPayment, batch, httpRequest);
            res.put("paymentUrl", paymentUrl);
            res.put("message", "Chuyển hướng đến cổng thanh toán VNPay...");
        } else {
            res.put("message", isCod ? "Đặt hàng COD thành công! Vui lòng thanh toán tiền mặt khi nhận hàng." : "Thanh toán thành công");
        }

        return res;
    }

    private String createVNPayPaymentUrl(Payment payment, CheckoutBatch batch, HttpServletRequest request) {
        String vnpVersion = VNPayConfig.VNP_VERSION;
        String vnpCommand = VNPayConfig.VNP_COMMAND;
        String tmnCode = vnPayConfig.getTmnCode();
        long amount = batch.getTotalAmount().multiply(BigDecimal.valueOf(100)).longValue();

        Map<String, String> vnpParams = new HashMap<>();
        vnpParams.put("vnp_Version", vnpVersion);
        vnpParams.put("vnp_Command", vnpCommand);
        vnpParams.put("vnp_TmnCode", tmnCode);
        vnpParams.put("vnp_Amount", String.valueOf(amount));
        vnpParams.put("vnp_CurrCode", VNPayConfig.VNP_CURR_CODE);
        vnpParams.put("vnp_TxnRef", payment.getPaymentCode());
        vnpParams.put("vnp_OrderInfo", "Thanh toan don hang " + batch.getCheckoutCode());
        vnpParams.put("vnp_OrderType", VNPayConfig.VNP_ORDER_TYPE);
        vnpParams.put("vnp_Locale", VNPayConfig.VNP_LOCALE);
        vnpParams.put("vnp_ReturnUrl", vnPayConfig.getReturnUrl());
        vnpParams.put("vnp_IpAddr", VNPayUtil.getIpAddress(request));

        Calendar cld = Calendar.getInstance(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
        SimpleDateFormat formatter = new SimpleDateFormat("yyyyMMddHHmmss");
        formatter.setTimeZone(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
        String vnpCreateDate = formatter.format(cld.getTime());
        vnpParams.put("vnp_CreateDate", vnpCreateDate);

        cld.add(Calendar.MINUTE, 15);
        String vnpExpireDate = formatter.format(cld.getTime());
        vnpParams.put("vnp_ExpireDate", vnpExpireDate);

        return VNPayUtil.buildPaymentUrl(vnpParams, vnPayConfig.getHashSecret(), vnPayConfig.getPayUrl());
    }

    @Override
    @Transactional
    public VNPayCallbackResultDTO processVNPayCallback(Map<String, String> queryParams) {
        log.info("Processing VNPay callback with params: {}", queryParams);

        boolean validSignature = VNPayUtil.verifySignature(queryParams, vnPayConfig.getHashSecret());
        if (!validSignature) {
            log.error("VNPay signature verification failed. QueryParams: {}", queryParams);
            return VNPayCallbackResultDTO.builder()
                    .success(false)
                    .message("Chữ ký bảo mật VNPay không hợp lệ")
                    .responseCode(queryParams.get("vnp_ResponseCode"))
                    .transactionNo(queryParams.get("vnp_TransactionNo"))
                    .build();
        }

        String paymentCode = queryParams.get("vnp_TxnRef");
        String responseCode = queryParams.get("vnp_ResponseCode");
        String transactionStatus = queryParams.get("vnp_TransactionStatus");
        String transactionNo = queryParams.get("vnp_TransactionNo");

        if (paymentCode == null || paymentCode.isEmpty()) {
            return VNPayCallbackResultDTO.builder()
                    .success(false)
                    .message("Không tìm thấy mã giao dịch VNPay trong kết quả trả về")
                    .responseCode(responseCode)
                    .transactionNo(transactionNo)
                    .build();
        }

        Payment payment = paymentRepository.findByPaymentCode(paymentCode).orElse(null);
        if (payment == null) {
            log.warn("Payment record not found for code: {}", paymentCode);
            return VNPayCallbackResultDTO.builder()
                    .success(false)
                    .paymentCode(paymentCode)
                    .responseCode(responseCode)
                    .transactionNo(transactionNo)
                    .message("Không tìm thấy thông tin thanh toán cho mã: " + paymentCode)
                    .build();
        }

        CheckoutBatch batch = checkoutBatchRepository.findById(payment.getCheckoutId()).orElse(null);
        String checkoutCode = (batch != null) ? batch.getCheckoutCode() : null;

        boolean isSuccess = "00".equals(responseCode) && (transactionStatus == null || "00".equals(transactionStatus));

        if (isSuccess) {
            if (payment.getStatus() != PaymentStatus.SUCCEEDED) {
                payment.setStatus(PaymentStatus.SUCCEEDED);
                payment.setProviderTransactionId(transactionNo);
                payment.setPaidAt(LocalDateTime.now());
                paymentRepository.save(payment);

                if (batch != null) {
                    List<Order> orders = orderRepository.findByCheckoutId(batch.getId());
                    for (Order order : orders) {
                        order.setStatus(OrderStatus.WAITING_CONFIRM);
                        order.setPaymentStatus(OrderPaymentStatus.PAID);
                        orderRepository.save(order);
                        if (orderStatusService != null) {
                            orderStatusService.recordHistory(
                                    order,
                                    OrderStatus.WAITING_PAYMENT,
                                    batch.getBuyerId(),
                                    "Thanh toán thành công qua VNPAY (Mã GD: " + transactionNo + ", Mã TT: " + paymentCode + ")"
                            );
                        }
                    }
                }
            }

            return VNPayCallbackResultDTO.builder()
                    .success(true)
                    .message("Thanh toán đơn hàng qua VNPay thành công!")
                    .checkoutCode(checkoutCode)
                    .paymentCode(paymentCode)
                    .responseCode(responseCode)
                    .transactionNo(transactionNo)
                    .build();
        } else {
            if (payment.getStatus() == PaymentStatus.PENDING) {
                payment.setStatus("24".equals(responseCode) ? PaymentStatus.CANCELLED : PaymentStatus.FAILED);
                payment.setProviderTransactionId(transactionNo);
                paymentRepository.save(payment);
            }

            String errorMessage = getVNPayErrorMessage(responseCode);
            return VNPayCallbackResultDTO.builder()
                    .success(false)
                    .message(errorMessage)
                    .checkoutCode(checkoutCode)
                    .paymentCode(paymentCode)
                    .responseCode(responseCode)
                    .transactionNo(transactionNo)
                    .build();
        }
    }

    private String getVNPayErrorMessage(String responseCode) {
        if (responseCode == null) {
            return "Thanh toán VNPay không thành công";
        }
        return switch (responseCode) {
            case "07" -> "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).";
            case "09" -> "Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking tại ngân hàng.";
            case "10" -> "Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.";
            case "11" -> "Đã hết hạn chờ thanh toán. Xin vui lòng thực hiện lại giao dịch.";
            case "12" -> "Thẻ/Tài khoản của quý khách bị khóa.";
            case "13" -> "Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).";
            case "24" -> "Giao dịch đã bị hủy bởi người dùng.";
            case "51" -> "Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.";
            case "65" -> "Tài khoản của quý khách đã vượt quá hạn mức giao dịch trong ngày.";
            case "75" -> "Ngân hàng thanh toán đang bảo trì.";
            case "79" -> "Nhập sai mật khẩu thanh toán quá số lần quy định.";
            default -> "Giao dịch thanh toán VNPay không thành công (Mã lỗi: " + responseCode + ").";
        };
    }
}
