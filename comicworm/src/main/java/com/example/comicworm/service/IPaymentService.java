package com.example.comicworm.service;

import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.dto.response.VNPayCallbackResultDTO;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;

public interface IPaymentService {
    default Map<String, Object> processCheckoutPayment(String checkoutCode, Long buyerId, ProcessPaymentRequest request) {
        return processCheckoutPayment(checkoutCode, buyerId, request, null);
    }

    Map<String, Object> processCheckoutPayment(String checkoutCode, Long buyerId, ProcessPaymentRequest request, HttpServletRequest httpRequest);

    VNPayCallbackResultDTO processVNPayCallback(Map<String, String> queryParams);
}
