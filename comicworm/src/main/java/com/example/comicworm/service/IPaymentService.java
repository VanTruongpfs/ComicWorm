package com.example.comicworm.service;

import com.example.comicworm.dto.request.ProcessPaymentRequest;

import java.util.Map;

public interface IPaymentService {
    Map<String, Object> processCheckoutPayment(String checkoutCode, Long buyerId, ProcessPaymentRequest request);
}
