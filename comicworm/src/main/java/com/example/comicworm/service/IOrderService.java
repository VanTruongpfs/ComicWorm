package com.example.comicworm.service;

import com.example.comicworm.dto.request.CreateOrderRequest;
import com.example.comicworm.dto.response.CheckoutSummaryDTO;

public interface IOrderService {
    String createOrderFromCart(Long buyerId, CreateOrderRequest request);
    String createDirectOrder(Long buyerId, Long productId, Integer quantity);
    CheckoutSummaryDTO getCheckoutSummary(String checkoutCode, Long buyerId);
    void updateCheckoutAddress(String checkoutCode, Long buyerId, CreateOrderRequest request);
}