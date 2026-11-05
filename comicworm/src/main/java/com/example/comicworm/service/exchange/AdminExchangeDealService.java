package com.example.comicworm.service.exchange;

import com.example.comicworm.dto.exchange.AdminExchangeDealDTO;
import com.example.comicworm.model.ExchangeOffer;
import com.example.comicworm.model.ExchangeOrderLink;
import com.example.comicworm.model.ExchangeRoom;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.ExchangeReviewStatus;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
import com.example.comicworm.repository.ExchangeOfferItemRepository;
import com.example.comicworm.repository.ExchangeOfferRepository;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.ExchangeRoomRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.NotificationService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Admin review of exchange deals. A deal reaches PENDING when both parties have created every delivery order;
 * the sender cannot prepare or ship until an admin approves it. Rejecting cancels the deal (stock, orders, payments).
 */
@Service
@Profile("!preview")
@RequiredArgsConstructor
@Transactional
public class AdminExchangeDealService {

    private static final int MAX_REASON = 500;

    private final ExchangeOfferRepository offers;
    private final ExchangeRoomRepository rooms;
    private final ExchangeOfferItemRepository offerItems;
    private final ExchangeOrderLinkRepository links;
    private final ProductRepository products;
    private final UserRepository users;
    private final ExchangeOrderService orderService;
    private final ExchangeEscrowService escrowService;
    private final NotificationService notifications;

    @Transactional(readOnly = true)
    public List<AdminExchangeDealDTO> list(String status) {
        ExchangeReviewStatus filter = parseStatus(status);
        return offers.findByAdminReviewStatusOrderByIdDesc(filter).stream()
                .map(offer -> {
                    ExchangeRoom room = rooms.findById(offer.getRoomId()).orElse(null);
                    if (room == null) return null;
                    // A party may cancel while the deal waits for review; it no longer needs a decision.
                    if (filter == ExchangeReviewStatus.PENDING && room.getStatus() == ExchangeRoomStatus.CANCELLED) return null;
                    return toDto(offer, room);
                })
                .filter(Objects::nonNull)
                .toList();
    }

    public AdminExchangeDealDTO approve(Long adminId, Long offerId) {
        ExchangeRoom room = lockRoomOf(offerId);
        ExchangeOffer offer = pendingOffer(room, offerId);
        offer.setAdminReviewStatus(ExchangeReviewStatus.APPROVED);
        offer.setReviewedBy(adminId);
        offer.setReviewedAt(LocalDateTime.now());
        offer.setReviewNote(null);

        notifyParties(room, offer, "Giao dịch trao đổi đã được duyệt",
                "Admin đã duyệt giao dịch trao đổi ở phòng " + room.getRoomCode() + ". Bên gửi có thể chuẩn bị và gửi truyện.",
                "EXCHANGE_REVIEW_APPROVED");
        return toDto(offer, room);
    }

    public AdminExchangeDealDTO reject(Long adminId, Long offerId, String reason) {
        String cleanReason = reason == null ? "" : reason.trim();
        if (cleanReason.isEmpty()) {
            throw error(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do từ chối");
        }
        if (cleanReason.length() > MAX_REASON) {
            throw error(HttpStatus.BAD_REQUEST, "Lý do không được vượt quá " + MAX_REASON + " ký tự");
        }
        ExchangeRoom room = lockRoomOf(offerId);
        ExchangeOffer offer = pendingOffer(room, offerId);
        offer.setAdminReviewStatus(ExchangeReviewStatus.REJECTED);
        offer.setReviewedBy(adminId);
        offer.setReviewedAt(LocalDateTime.now());
        offer.setReviewNote(cleanReason);
        orderService.cancelByAdmin(room, offer, adminId, "Admin từ chối giao dịch: " + cleanReason);

        notifyParties(room, offer, "Giao dịch trao đổi bị từ chối",
                "Admin đã từ chối giao dịch trao đổi ở phòng " + room.getRoomCode() + " và hủy các đơn liên quan. Lý do: "
                        + cleanReason,
                "EXCHANGE_REVIEW_REJECTED");
        return toDto(offer, room);
    }

    /** Locks the room first, then reads the offer, so a concurrent decision is seen. */
    private ExchangeRoom lockRoomOf(Long offerId) {
        Long roomId = offers.findRoomIdById(offerId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy giao dịch trao đổi"));
        return rooms.findByIdForUpdate(roomId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy phòng trao đổi"));
    }

    private ExchangeOffer pendingOffer(ExchangeRoom room, Long offerId) {
        ExchangeOffer offer = offers.findById(offerId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy giao dịch trao đổi"));
        if (!offerId.equals(room.getSelectedOfferId()) || room.getStatus() == ExchangeRoomStatus.CANCELLED) {
            throw error(HttpStatus.CONFLICT, "Giao dịch này không còn hiệu lực");
        }
        if (offer.getAdminReviewStatus() != ExchangeReviewStatus.PENDING) {
            throw error(HttpStatus.CONFLICT, "Giao dịch không ở trạng thái chờ duyệt");
        }
        return offer;
    }

    /** Each party gets one notification, attached to the order they receive (or any order of the deal). */
    private void notifyParties(ExchangeRoom room, ExchangeOffer offer, String title, String content, String keyPrefix) {
        List<ExchangeOrderLink> dealLinks = links.findByRoomIdOrderByIdAsc(room.getId());
        if (dealLinks.isEmpty()) return;
        Map<Long, Long> orderByRecipient = dealLinks.stream()
                .collect(Collectors.toMap(ExchangeOrderLink::getRecipientId, ExchangeOrderLink::getOrderId, (a, b) -> a));
        Long fallbackOrder = dealLinks.get(0).getOrderId();
        for (Long userId : List.of(room.getHostId(), offer.getBuyerId())) {
            notifications.notify(userId, orderByRecipient.getOrDefault(userId, fallbackOrder), title, content,
                    keyPrefix + ":" + offer.getId() + ":" + userId);
        }
    }

    private AdminExchangeDealDTO toDto(ExchangeOffer offer, ExchangeRoom room) {
        Product target = products.findById(room.getTargetProductId()).orElse(null);
        List<AdminExchangeDealDTO.Item> partnerItems = offerItems.findByOfferId(offer.getId()).stream()
                .map(i -> new AdminExchangeDealDTO.Item(i.getTitleSnapshot(), i.getQuantity(), i.getConditionSnapshot()))
                .toList();
        return new AdminExchangeDealDTO(offer.getId(), room.getId(), room.getRoomCode(), room.getStatus().name(),
                offer.getAdminReviewStatus().name(), offer.getReviewNote(), offer.getReviewedAt(),
                room.getHostId(), name(room.getHostId()), offer.getBuyerId(), name(offer.getBuyerId()),
                target != null ? target.getTitle() : "Sản phẩm #" + room.getTargetProductId(),
                target != null ? target.getCoverImageUrl() : null, partnerItems,
                offer.getCashCompensation(),
                offer.getCompensationPayerId() == null ? null : name(offer.getCompensationPayerId()),
                orderService.orderDtos(room.getId()), escrowService.forOffer(offer.getId()));
    }

    private ExchangeReviewStatus parseStatus(String status) {
        try {
            ExchangeReviewStatus parsed = ExchangeReviewStatus.valueOf(
                    (status == null ? "PENDING" : status.trim()).toUpperCase(Locale.ROOT));
            if (parsed == ExchangeReviewStatus.NOT_SUBMITTED) throw new IllegalArgumentException();
            return parsed;
        } catch (IllegalArgumentException e) {
            throw error(HttpStatus.BAD_REQUEST, "Trạng thái duyệt không hợp lệ");
        }
    }

    private String name(Long userId) {
        return users.findById(userId).map(User::getFullName).orElse("Thành viên");
    }

    private static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
