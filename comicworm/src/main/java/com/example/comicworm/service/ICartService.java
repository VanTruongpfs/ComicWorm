package com.example.comicworm.service;

import com.example.comicworm.dto.request.AddToCartRequest;
import com.example.comicworm.dto.request.UpdateCartItemRequest;
import com.example.comicworm.dto.response.CartResponseDTO;

public interface ICartService {
    CartResponseDTO getCart(Long userId);
    void addToCart(Long userId, AddToCartRequest request);
    void updateCartItem(Long userId, Long cartItemId, UpdateCartItemRequest request);
    void removeCartItem(Long userId, Long cartItemId);
    void clearCart(Long userId);
}