package com.example.comicworm.service.impl;

import com.example.comicworm.dto.request.AddToCartRequest;
import com.example.comicworm.dto.request.UpdateCartItemRequest;
import com.example.comicworm.dto.response.CartResponseDTO;
import com.example.comicworm.model.Cart;
import com.example.comicworm.model.CartItem;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.repository.CartItemRepository;
import com.example.comicworm.repository.CartRepository;
import com.example.comicworm.repository.ProductImageRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.ICartService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CartServiceImpl implements ICartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;
    private final UserRepository userRepository;

    public CartServiceImpl(
            CartRepository cartRepository,
            CartItemRepository cartItemRepository,
            ProductRepository productRepository,
            ProductImageRepository productImageRepository,
            UserRepository userRepository) {
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.productRepository = productRepository;
        this.productImageRepository = productImageRepository;
        this.userRepository = userRepository;
    }

    private Cart getOrCreateCart(Long userId) {
        return cartRepository.findByUserId(userId).orElseGet(() -> {
            Cart newCart = new Cart();
            newCart.setUserId(userId);
            return cartRepository.save(newCart);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public CartResponseDTO getCart(Long userId) {
        Cart cart = getOrCreateCart(userId);
        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());

        List<CartResponseDTO.CartItemDTO> itemDtos = items.stream().map(item -> {
            Product p = productRepository.findById(item.getProductId())
                    .orElseThrow(() -> new IllegalArgumentException("Sản phẩm không tồn tại"));

            String imageUrl = productImageRepository.findFirstByProductIdOrderByDisplayOrderAsc(p.getId())
                    .map(ProductImage::getImageUrl)
                    .orElse(null);

            String sellerName = userRepository.findById(p.getSellerId())
                    .map(User::getFullName)
                    .orElse("Người bán");

            return CartResponseDTO.CartItemDTO.builder()
                    .cartItemId(item.getId())
                    .productId(p.getId())
                    .productTitle(p.getTitle())
                    .price(p.getPrice())
                    .quantity(item.getQuantity())
                    .conditionPercent(p.getConditionPercent())
                    .isSelected(item.getIsSelected())
                    .sellerId(p.getSellerId())
                    .sellerName(sellerName)
                    .imageUrl(imageUrl)
                    .build();
        }).collect(Collectors.toList());

        BigDecimal total = itemDtos.stream()
                .filter(CartResponseDTO.CartItemDTO::getIsSelected)
                .map(i -> i.getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return CartResponseDTO.builder()
                .cartId(cart.getId())
                .items(itemDtos)
                .totalAmount(total)
                .build();
    }

    @Override
    @Transactional
    public void addToCart(Long userId, AddToCartRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm"));

        if (product.getSellerId().equals(userId)) {
            throw new IllegalStateException("Bạn không thể thêm sản phẩm do chính mình đăng bán vào giỏ hàng");
        }

        if (!Boolean.TRUE.equals(product.getIsActive()) || product.getModerationStatus() != ModerationStatus.APPROVED) {
            throw new IllegalStateException("Sản phẩm chưa sẵn sàng để bán");
        }

        if (product.getStockQuantity() < request.getQuantity()) {
            throw new IllegalStateException("Số lượng trong kho không đủ (chỉ còn " + product.getStockQuantity() + ")");
        }

        Cart cart = getOrCreateCart(userId);
        CartItem cartItem = cartItemRepository.findByCartIdAndProductId(cart.getId(), product.getId())
                .orElse(null);

        if (cartItem == null) {
            cartItem = new CartItem();
            cartItem.setCartId(cart.getId());
            cartItem.setProductId(product.getId());
            cartItem.setQuantity(request.getQuantity());
            cartItem.setIsSelected(true);
        } else {
            int newQty = cartItem.getQuantity() + request.getQuantity();
            if (newQty > product.getStockQuantity()) {
                throw new IllegalStateException("Số lượng yêu cầu (" + newQty + ") vượt quá tồn kho hiện có (" + product.getStockQuantity() + ")");
            }
            cartItem.setQuantity(newQty);
        }

        cartItemRepository.save(cartItem);
    }

    @Override
    @Transactional
    public void updateCartItem(Long userId, Long cartItemId, UpdateCartItemRequest request) {
        Cart cart = getOrCreateCart(userId);
        CartItem item = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new IllegalArgumentException("Mục giỏ hàng không tồn tại"));

        if (!item.getCartId().equals(cart.getId())) {
            throw new IllegalStateException("Bạn không có quyền chỉnh sửa mục giỏ hàng này");
        }

        if (request.getQuantity() != null) {
            if (request.getQuantity() <= 0) {
                cartItemRepository.delete(item);
                return;
            }

            Product p = productRepository.findById(item.getProductId())
                    .orElseThrow(() -> new IllegalArgumentException("Sản phẩm không tồn tại"));
            if (request.getQuantity() > p.getStockQuantity()) {
                throw new IllegalStateException("Số lượng vượt quá tồn kho (chỉ còn " + p.getStockQuantity() + ")");
            }
            item.setQuantity(request.getQuantity());
        }

        if (request.getIsSelected() != null) {
            item.setIsSelected(request.getIsSelected());
        }

        cartItemRepository.save(item);
    }

    @Override
    @Transactional
    public void removeCartItem(Long userId, Long cartItemId) {
        Cart cart = getOrCreateCart(userId);
        CartItem item = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new IllegalArgumentException("Mục giỏ hàng không tồn tại"));

        if (!item.getCartId().equals(cart.getId())) {
            throw new IllegalStateException("Bạn không có quyền xóa mục giỏ hàng này");
        }

        cartItemRepository.delete(item);
    }

    @Override
    @Transactional
    public void clearCart(Long userId) {
        Cart cart = getOrCreateCart(userId);
        cartItemRepository.deleteAllByCartId(cart.getId());
    }
}