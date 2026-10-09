package com.example.comicworm.service;

import com.example.comicworm.dto.request.CreateOrderRequest;
import com.example.comicworm.dto.response.CheckoutSummaryDTO;

public interface IOrderService {
    String createOrderFromCart(Long buyerId, CreateOrderRequest request);
    CheckoutSummaryDTO getCheckoutSummary(String checkoutCode, Long buyerId);
}