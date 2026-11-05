package com.example.comicworm.service.exchange;

import com.example.comicworm.dto.exchange.EscrowDTO;
import com.example.comicworm.dto.exchange.EscrowListDTO;
import com.example.comicworm.model.ExchangeEscrow;
import com.example.comicworm.model.ExchangeOffer;
import com.example.comicworm.model.ExchangeOrderLink;
import com.example.comicworm.model.ExchangeRoom;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.EscrowStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.WalletTransactionType;
import com.example.comicworm.repository.ExchangeEscrowRepository;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.ExchangeRoomRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.NotificationService;
import com.example.comicworm.service.wallet.WalletService;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Escrow of the cash compensation in an exchange deal.
 *
 * <p>When the compensation payer confirms receipt and pays COD, the platform holds that amount (HELD). Once every
 * order of the deal is completed it becomes READY. An admin then releases it to the payee's wallet, or refunds it to
 * the payer's wallet (allowed while HELD or READY, for disputes). Shipping fees never enter escrow.
 *
 * <p>Lock order: room (callers of {@link #onOrderReceived}), then escrow, then wallet.
 */
@Service
@Profile("!preview")
@RequiredArgsConstructor
@Transactional
public class ExchangeEscrowService {

    private static final int MAX_NOTE = 500;

    private final ExchangeEscrowRepository escrows;
    private final ExchangeRoomRepository rooms;
    private final ExchangeOrderLinkRepository links;
    private final OrderRepository orders;
    private final UserRepository users;
    private final WalletService wallet;
    private final NotificationService notifications;

    /**
     * Called with the room locked, after {@code receivedOrder} became COMPLETED.
     * {@code dealOrders} are all orders of the deal, including {@code receivedOrder}.
     */
    public void onOrderReceived(ExchangeRoom room, ExchangeOffer offer, Order receivedOrder, List<Order> dealOrders) {
        ExchangeEscrow escrow = escrows.findByOfferId(offer.getId()).orElse(null);
        LocalDateTime now = LocalDateTime.now();

        BigDecimal cash = offer.getCashCompensation();
        Long payer = offer.getCompensationPayerId();
        boolean payerPaid = payer != null && payer.equals(receivedOrder.getBuyerId());
        if (escrow == null && cash != null && cash.signum() > 0 && payerPaid) {
            escrow = new ExchangeEscrow();
            escrow.setRoomId(room.getId());
            escrow.setOfferId(offer.getId());
            escrow.setPayerId(payer);
            escrow.setPayeeId(payer.equals(room.getHostId()) ? offer.getBuyerId() : room.getHostId());
            escrow.setSourceOrderId(receivedOrder.getId());
            escrow.setAmount(cash);
            escrow.setStatus(EscrowStatus.HELD);
            escrow.setHeldAt(now);
            escrow = escrows.save(escrow);
        }

        boolean allCompleted = dealOrders.stream().allMatch(o -> o.getStatus() == OrderStatus.COMPLETED);
        if (escrow != null && escrow.getStatus() == EscrowStatus.HELD && allCompleted) {
            escrow.setStatus(EscrowStatus.READY);
            escrow.setReadyAt(now);
            escrows.save(escrow);
        }
    }

    public EscrowDTO release(Long adminId, Long escrowId, String note) {
        String cleanNote = requireNote(note);
        ExchangeEscrow escrow = lock(escrowId);
        if (escrow.getStatus() != EscrowStatus.READY) {
            throw error(HttpStatus.CONFLICT, escrow.getStatus() == EscrowStatus.HELD
                    ? "Chưa thể giải ngân: còn đơn của giao dịch chưa hoàn tất"
                    : "Khoản ký quỹ này đã được xử lý");
        }
        wallet.credit(escrow.getPayeeId(), escrow.getAmount(), WalletTransactionType.ESCROW_RELEASE, escrow.getId(), cleanNote);
        resolve(escrow, EscrowStatus.RELEASED, adminId, cleanNote);

        Long payeeOrderId = links.findByRoomIdAndRecipientId(escrow.getRoomId(), escrow.getPayeeId())
                .map(ExchangeOrderLink::getOrderId)
                .orElse(escrow.getSourceOrderId());
        notifications.notify(escrow.getPayeeId(), payeeOrderId, "Tiền bù đã về ví",
                "Admin đã giải ngân " + money(escrow.getAmount()) + " tiền bù của giao dịch trao đổi vào ví của bạn.",
                "EXCHANGE_ESCROW_RELEASED:" + escrow.getId());
        return toDto(escrow);
    }

    public EscrowDTO refund(Long adminId, Long escrowId, String note) {
        String cleanNote = requireNote(note);
        ExchangeEscrow escrow = lock(escrowId);
        if (escrow.getStatus() != EscrowStatus.HELD && escrow.getStatus() != EscrowStatus.READY) {
            throw error(HttpStatus.CONFLICT, "Khoản ký quỹ này đã được xử lý");
        }
        wallet.credit(escrow.getPayerId(), escrow.getAmount(), WalletTransactionType.ESCROW_REFUND, escrow.getId(), cleanNote);
        resolve(escrow, EscrowStatus.REFUNDED, adminId, cleanNote);

        notifications.notify(escrow.getPayerId(), escrow.getSourceOrderId(), "Tiền bù đã được hoàn vào ví",
                "Admin đã hoàn " + money(escrow.getAmount()) + " tiền bù của giao dịch trao đổi vào ví của bạn. Lý do: "
                        + cleanNote,
                "EXCHANGE_ESCROW_REFUNDED:" + escrow.getId());
        return toDto(escrow);
    }

    @Transactional(readOnly = true)
    public EscrowListDTO list(String status) {
        EscrowStatus filter = parseStatus(status);
        List<ExchangeEscrow> items = filter == null ? escrows.findAllByOrderByIdDesc() : escrows.findByStatusOrderByIdDesc(filter);

        Map<String, EscrowListDTO.Total> totals = new LinkedHashMap<>();
        for (EscrowStatus s : EscrowStatus.values()) {
            totals.put(s.name(), new EscrowListDTO.Total(0, BigDecimal.ZERO));
        }
        for (ExchangeEscrowRepository.StatusTotal row : escrows.totalsByStatus()) {
            totals.put(row.getStatus().name(), new EscrowListDTO.Total(row.getCount(), row.getTotal()));
        }
        return new EscrowListDTO(items.stream().map(this::toDto).toList(), totals);
    }

    /** Escrow of a deal, or null when nothing is held (no compensation, or not paid yet). */
    @Transactional(readOnly = true)
    public EscrowDTO forOffer(Long offerId) {
        return escrows.findByOfferId(offerId).map(this::toDto).orElse(null);
    }

    private ExchangeEscrow lock(Long escrowId) {
        return escrows.findByIdForUpdate(escrowId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy khoản ký quỹ"));
    }

    private void resolve(ExchangeEscrow escrow, EscrowStatus status, Long adminId, String note) {
        escrow.setStatus(status);
        escrow.setResolvedBy(adminId);
        escrow.setResolvedAt(LocalDateTime.now());
        escrow.setResolutionNote(note);
        escrows.save(escrow);
    }

    private String requireNote(String note) {
        String clean = note == null ? "" : note.trim();
        if (clean.isEmpty()) {
            throw error(HttpStatus.BAD_REQUEST, "Vui lòng ghi chú lý do hoặc mã đối soát");
        }
        if (clean.length() > MAX_NOTE) {
            throw error(HttpStatus.BAD_REQUEST, "Ghi chú không được vượt quá " + MAX_NOTE + " ký tự");
        }
        return clean;
    }

    private EscrowStatus parseStatus(String status) {
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        try {
            return EscrowStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw error(HttpStatus.BAD_REQUEST, "Trạng thái ký quỹ không hợp lệ");
        }
    }

    EscrowDTO toDto(ExchangeEscrow e) {
        String roomCode = rooms.findById(e.getRoomId()).map(ExchangeRoom::getRoomCode).orElse(null);
        String orderCode = orders.findById(e.getSourceOrderId()).map(Order::getOrderCode).orElse(null);
        return new EscrowDTO(e.getId(), e.getRoomId(), roomCode, e.getOfferId(),
                e.getPayerId(), name(e.getPayerId()), e.getPayeeId(), name(e.getPayeeId()),
                e.getAmount(), e.getStatus().name(), orderCode,
                e.getHeldAt(), e.getReadyAt(), e.getResolvedAt(), e.getResolutionNote());
    }

    private String name(Long userId) {
        return users.findById(userId).map(User::getFullName).orElse("Thành viên");
    }

    private static String money(BigDecimal amount) {
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(amount) + "₫";
    }

    private static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
