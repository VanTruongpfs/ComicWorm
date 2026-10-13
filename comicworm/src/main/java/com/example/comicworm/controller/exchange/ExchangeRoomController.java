package com.example.comicworm.controller.exchange;

import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
import com.example.comicworm.service.exchange.IExchangeRoomService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/exchange/rooms")
@Profile("!preview")
@RequiredArgsConstructor
public class ExchangeRoomController {

    private final IExchangeRoomService exchangeRoomService;

    /**
     * Danh sách phòng công khai trên sàn trao đổi
     */
    @GetMapping
    public ResponseEntity<List<ExchangeRoomSummaryDTO>> listRooms(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) ExchangeRoomStatus status
    ) {
        return ResponseEntity.ok(exchangeRoomService.listRooms(keyword, status));
    }

    /**
     * Danh sách phòng của tôi (tôi là chủ hoặc người tham gia)
     */
    @GetMapping("/my")
    public ResponseEntity<List<ExchangeRoomSummaryDTO>> listMyRooms(
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long userId = requireUserId(user);
        return ResponseEntity.ok(exchangeRoomService.listMyRooms(userId));
    }

    /**
     * Lấy kho truyện của người dùng hiện tại để chọn khi gửi đề xuất
     */
    @GetMapping("/inventory")
    public ResponseEntity<List<UserTradeProductDTO>> getUserInventory(
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long userId = requireUserId(user);
        return ResponseEntity.ok(exchangeRoomService.getUserInventoryForTrade(userId));
    }

    /**
     * Chi tiết phòng trao đổi theo ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<ExchangeRoomDTO> getRoom(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long currentUserId = user != null ? user.getId() : null;
        return ResponseEntity.ok(exchangeRoomService.getRoomDetail(id, currentUserId));
    }

    /**
     * Chi tiết phòng trao đổi theo mã phòng (roomCode)
     */
    @GetMapping("/by-code/{code}")
    public ResponseEntity<ExchangeRoomDTO> getRoomByCode(
            @PathVariable String code,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long currentUserId = user != null ? user.getId() : null;
        return ResponseEntity.ok(exchangeRoomService.getRoomByCode(code, currentUserId));
    }

    /**
     * Tạo hoặc vào phòng trao đổi cho một sản phẩm cụ thể
     */
    @PostMapping
    public ResponseEntity<ExchangeRoomDTO> createOrGetRoom(
            @Valid @RequestBody CreateExchangeRoomRequest req,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long userId = requireUserId(user);
        ExchangeRoomDTO room = exchangeRoomService.createOrGetRoomForProduct(
                userId,
                req.getTargetProductId(),
                req.getInitialMessage()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(room);
    }

    /**
     * Tham gia phòng trao đổi
     */
    @PostMapping("/{id}/join")
    public ResponseEntity<Void> joinRoom(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long userId = requireUserId(user);
        exchangeRoomService.joinRoom(id, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Lấy danh sách tin nhắn trong phòng
     */
    @GetMapping("/{id}/messages")
    public ResponseEntity<List<ExchangeMessageDTO>> getMessages(
            @PathVariable Long id,
            @RequestParam(required = false) Long afterId
    ) {
        return ResponseEntity.ok(exchangeRoomService.getMessages(id, afterId));
    }

    /**
     * Gửi tin nhắn vào phòng
     */
    @PostMapping("/{id}/messages")
    public ResponseEntity<ExchangeMessageDTO> sendMessage(
            @PathVariable Long id,
            @RequestBody SendExchangeMessageRequest req,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long userId = requireUserId(user);
        ExchangeMessageDTO message = exchangeRoomService.sendMessage(id, userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }

    /**
     * Gửi đề xuất trao đổi / kèo đổi / bù tiền
     */
    @PostMapping("/{id}/offers")
    public ResponseEntity<ExchangeOfferDTO> proposeOffer(
            @PathVariable Long id,
            @Valid @RequestBody CreateExchangeOfferRequest req,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long userId = requireUserId(user);
        ExchangeOfferDTO offer = exchangeRoomService.proposeOffer(id, userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(offer);
    }

    /**
     * Chủ phòng phản hồi đề xuất (chấp nhận hoặc từ chối)
     */
    @PostMapping("/{id}/offers/{offerId}/respond")
    public ResponseEntity<ExchangeOfferDTO> respondOffer(
            @PathVariable Long id,
            @PathVariable Long offerId,
            @RequestParam boolean accept,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long hostId = requireUserId(user);
        ExchangeOfferDTO offer = exchangeRoomService.respondToOffer(id, offerId, hostId, accept);
        return ResponseEntity.ok(offer);
    }

    /**
     * Xác nhận chốt thỏa thuận (host hoặc buyer)
     */
    @PostMapping("/{id}/offers/{offerId}/confirm")
    public ResponseEntity<ExchangeOfferDTO> confirmDeal(
            @PathVariable Long id,
            @PathVariable Long offerId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long userId = requireUserId(user);
        ExchangeOfferDTO offer = exchangeRoomService.confirmDeal(id, offerId, userId);
        return ResponseEntity.ok(offer);
    }

    /**
     * Người đề xuất rút lại đề xuất của mình
     */
    @PostMapping("/{id}/offers/{offerId}/withdraw")
    public ResponseEntity<Void> withdrawOffer(
            @PathVariable Long id,
            @PathVariable Long offerId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long userId = requireUserId(user);
        exchangeRoomService.withdrawOffer(id, offerId, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Đóng / hủy phòng trao đổi (chỉ chủ phòng)
     */
    @PostMapping("/{id}/close")
    public ResponseEntity<Void> closeRoom(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long hostId = requireUserId(user);
        exchangeRoomService.closeRoom(id, hostId);
        return ResponseEntity.ok().build();
    }

    private Long requireUserId(CustomUserDetails user) {
        if (user == null || user.getId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để thực hiện chức năng này");
        }
        return user.getId();
    }
}
