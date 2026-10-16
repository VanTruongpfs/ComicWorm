package com.example.comicworm.service.exchange;

import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.model.*;
import com.example.comicworm.model.enums.*;
import com.example.comicworm.repository.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @Profile("!preview") @RequiredArgsConstructor @Transactional
public class ExchangeOrderService {
    private final ExchangeRoomRepository rooms;
    private final ExchangeOfferRepository offers;
    private final ExchangeOfferItemRepository offeredItems;
    private final ExchangeOrderLinkRepository links;
    private final UserAddressRepository addresses;
    private final ProductRepository products;
    private final CheckoutBatchRepository batches;
    private final OrderRepository orders;
    private final OrderItemRepository items;
    private final OrderStatusHistoryRepository history;
    private final PaymentRepository payments;
    private final PaymentAllocationRepository allocations;
    private final UserRepository users;
    private final IExchangeRoomService roomService;
    @Value("${app.exchange.shipping.standard-fee:25000}") private BigDecimal standardFee;
    @Value("${app.exchange.shipping.express-fee:40000}") private BigDecimal expressFee;

    private ResponseStatusException error(HttpStatus status, String message) { return new ResponseStatusException(status, message); }
    private ExchangeRoom room(Long roomId, Long userId, boolean lock) {
        if (userId == null) throw error(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        return (lock ? rooms.findByIdForUpdate(roomId) : rooms.findById(roomId))
            .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy phòng"));
    }
    private ExchangeOffer selected(ExchangeRoom room, Long userId) {
        if (room.getSelectedOfferId() == null) throw error(HttpStatus.BAD_REQUEST, "Chủ phòng chưa chọn đề xuất");
        var offer = offers.findByIdAndRoomId(room.getSelectedOfferId(), room.getId())
            .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy đề xuất"));
        if (!userId.equals(room.getHostId()) && !userId.equals(offer.getBuyerId()))
            throw error(HttpStatus.FORBIDDEN, "Bạn không thuộc giao dịch này");
        return offer;
    }
    private List<ExchangeCheckoutDTO.ShippingOption> shippingOptions() {
        return List.of(new ExchangeCheckoutDTO.ShippingOption("STANDARD", "Giao tiêu chuẩn", standardFee),
            new ExchangeCheckoutDTO.ShippingOption("EXPRESS", "Giao nhanh", expressFee));
    }
    @Transactional(readOnly = true)
    public ExchangeCheckoutDTO checkout(Long roomId, Long userId) {
        var room = room(roomId, userId, false);
        var offer = selected(room, userId);
        var hasTrade = !offeredItems.findByOfferId(offer.getId()).isEmpty();
        return new ExchangeCheckoutDTO(roomService.getRoomDetail(roomId, userId),
            links.findByRoomIdOrderByIdAsc(roomId).stream().map(this::dto).toList(),
            shippingOptions(), List.of("COD"), userId.equals(offer.getBuyerId()) || hasTrade,
            hasTrade ? 2 : 1, userId.equals(offer.getCompensationPayerId()) ? offer.getCashCompensation() : BigDecimal.ZERO);
    }
    @Transactional(readOnly = true)
    public List<ExchangeCheckoutDTO> myDeals(Long userId) {
        if (userId == null) throw error(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        return rooms.findRoomsByUser(userId).stream().filter(r -> r.getSelectedOfferId() != null)
            .filter(r -> userId.equals(r.getHostId()) || offers.findByIdAndRoomId(r.getSelectedOfferId(), r.getId())
                .map(o -> userId.equals(o.getBuyerId())).orElse(false))
            .map(r -> checkout(r.getId(), userId)).toList();
    }

    public ExchangeOrderDTO create(Long roomId, Long userId, CreateExchangeOrderRequest request) {
        var room = room(roomId, userId, true);
        var offer = selected(room, userId);
        if (room.getStatus() != ExchangeRoomStatus.COMPLETED || offer.getStatus() != ExchangeOfferStatus.ACCEPTED
                || !Boolean.TRUE.equals(offer.getHostConfirmed()) || !Boolean.TRUE.equals(offer.getBuyerConfirmed()))
            throw error(HttpStatus.CONFLICT, "Cần cả hai bên xác nhận giao dịch trước khi tạo đơn");
        var existing = links.findByRoomIdAndRecipientId(roomId, userId);
        if (existing.isPresent()) return dto(existing.get());
        var address = addresses.findByIdAndUserId(request.addressId(), userId)
            .orElseThrow(() -> error(HttpStatus.BAD_REQUEST, "Vui lòng chọn địa chỉ nhận hàng của bạn"));
        var shipping = shippingOptions().stream().filter(s -> s.code().equals(request.shippingMethod())).findFirst()
            .orElseThrow(() -> error(HttpStatus.BAD_REQUEST, "Hình thức vận chuyển không hợp lệ"));
        if (!"COD".equals(request.paymentMethod())) throw error(HttpStatus.BAD_REQUEST, "Hiện hỗ trợ thanh toán COD");

        var tradeItems = offeredItems.findByOfferId(offer.getId());
        boolean isBuyer = userId.equals(offer.getBuyerId());
        if (!isBuyer && tradeItems.isEmpty()) throw error(HttpStatus.BAD_REQUEST, "Giao dịch mua bằng tiền chỉ có một đơn giao cho người mua");
        // Reserve every leg together on the first order. This prevents a partial exchange when another deal consumes stock.
        if (links.findByRoomIdOrderByIdAsc(roomId).isEmpty()) {
            var quantities = new TreeMap<Long, Integer>();
            quantities.put(room.getTargetProductId(), 1);
            tradeItems.forEach(i -> quantities.merge(i.getProductId(), i.getQuantity(), Integer::sum));
            for (var entry : quantities.entrySet()) {
                Long owner = entry.getKey().equals(room.getTargetProductId()) ? room.getHostId() : offer.getBuyerId();
                var p = products.lockOwnedProduct(entry.getKey(), owner)
                    .orElseThrow(() -> error(HttpStatus.CONFLICT, "Truyện trong giao dịch không còn tồn tại"));
                if (!Boolean.TRUE.equals(p.getIsActive()) || p.getStockQuantity() < entry.getValue())
                    throw error(HttpStatus.CONFLICT, "Truyện không còn đủ tồn kho: " + p.getTitle());
                p.setStockQuantity(p.getStockQuantity() - entry.getValue());
            }
        }
        Long senderId = isBuyer ? room.getHostId() : offer.getBuyerId();
        BigDecimal cash = userId.equals(offer.getCompensationPayerId()) ? offer.getCashCompensation() : BigDecimal.ZERO;
        BigDecimal total = cash.add(shipping.fee());
        var batch = new CheckoutBatch();
        batch.setCheckoutCode(code("EXC")); batch.setBuyerId(userId);
        batch.setIdempotencyKey("exchange-" + roomId + "-" + userId);
        batch.setTotalAmount(total); batch.setExpiresAt(LocalDateTime.now().plusDays(7));
        batch = batches.save(batch);
        var order = new Order();
        order.setOrderCode(code("EX")); order.setCheckoutId(batch.getId());
        order.setBuyerId(userId); order.setSellerId(senderId);
        order.setSubtotalAmount(cash); order.setShippingFee(shipping.fee()); order.setTotalAmount(total);
        order.setRecipientName(address.getRecipientName()); order.setRecipientPhone(address.getPhone());
        order.setShippingAddress(address.getAddressDetail() + ", " + address.getWard() + ", " + address.getDistrict() + ", " + address.getProvince());
        order.setBuyerNote(request.note()); order.setStatus(OrderStatus.WAITING_CONFIRM);
        order.setPaymentStatus(OrderPaymentStatus.PENDING); order = orders.save(order);
        if (isBuyer) {
            var p = products.findById(room.getTargetProductId()).orElseThrow();
            saveItem(order.getId(), p, p.getTitle(), p.getConditionPercent(), 1, tradeItems.isEmpty() ? cash : BigDecimal.ZERO);
        } else {
            for (int n = 0; n < tradeItems.size(); n++) {
                var item = tradeItems.get(n);
                var p = products.findById(item.getProductId()).orElseThrow();
                saveItem(order.getId(), p, item.getTitleSnapshot(), item.getConditionSnapshot(), item.getQuantity(),
                    BigDecimal.ZERO);
            }
        }
        var payment = new Payment();
        payment.setCheckoutId(batch.getId()); payment.setPaymentCode(code("EXP"));
        payment.setIdempotencyKey("exchange-payment-" + roomId + "-" + userId);
        payment.setMethod(PaymentMethod.COD); payment.setAmount(total); payment.setStatus(PaymentStatus.PENDING);
        payment = payments.save(payment);
        var allocation = new PaymentAllocation(); allocation.setPaymentId(payment.getId());
        allocation.setOrderId(order.getId()); allocation.setAmount(total); allocations.save(allocation);
        var link = new ExchangeOrderLink(); link.setRoomId(roomId); link.setOfferId(offer.getId());
        link.setRecipientId(userId); link.setOrderId(order.getId()); link.setShippingMethod(shipping.code());
        link = links.save(link); record(order, null, userId, "Tạo đơn nhận truyện; thanh toán COD khi nhận hàng");
        return dto(link);
    }

    public ExchangeOrderDTO updateStatus(Long orderId, Long userId, String action) {
        var link = links.findByOrderId(orderId).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy đơn trao đổi"));
        var room = room(link.getRoomId(), userId, true);
        var offer = selected(room, userId);
        var order = orders.findById(orderId).orElseThrow();
        if ("CANCEL".equals(action)) { cancel(room, offer, userId); return dto(link); }
        if (room.getStatus() == ExchangeRoomStatus.CANCELLED || order.getStatus() == OrderStatus.CANCELLED)
            throw error(HttpStatus.CONFLICT, "Giao dịch đã hủy");
        var previous = order.getStatus();
        if (action == null) throw error(HttpStatus.BAD_REQUEST, "Chọn thao tác cập nhật đơn");
        var next = switch (action) {
            case "ACCEPT" -> OrderStatus.PACKING;
            case "SHIP" -> OrderStatus.SHIPPING;
            case "RECEIVE" -> OrderStatus.COMPLETED;
            default -> throw error(HttpStatus.BAD_REQUEST, "Thao tác không hợp lệ");
        };
        boolean receive = "RECEIVE".equals(action);
        if (!userId.equals(receive ? order.getBuyerId() : order.getSellerId()))
            throw error(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này");
        if (previous == next) return dto(link);
        if ((!receive && next == OrderStatus.PACKING && previous != OrderStatus.WAITING_CONFIRM)
                || (next == OrderStatus.SHIPPING && previous != OrderStatus.PACKING)
                || (receive && previous != OrderStatus.SHIPPING && previous != OrderStatus.DELIVERED))
            throw error(HttpStatus.CONFLICT, "Trạng thái đơn không cho phép thao tác này");
        int required = offeredItems.findByOfferId(offer.getId()).isEmpty() ? 1 : 2;
        if (links.findByRoomIdOrderByIdAsc(room.getId()).size() < required)
            throw error(HttpStatus.CONFLICT, "Cần cả hai bên tạo đơn nhận truyện trước khi gửi hàng");
        order.setStatus(next);
        if (receive) {
            order.setCompletedAt(LocalDateTime.now()); order.setPaymentStatus(OrderPaymentStatus.PAID);
            payments.findByCheckoutId(order.getCheckoutId()).forEach(p -> {
                p.setStatus(PaymentStatus.SUCCEEDED); p.setPaidAt(LocalDateTime.now());
            });
        }
        record(order, previous, userId, receive ? "Người nhận xác nhận đã nhận truyện và thanh toán COD" : action);
        return dto(link);
    }

    public void cancelDeal(Long roomId, Long userId) {
        var room = room(roomId, userId, true);
        cancel(room, selected(room, userId), userId);
    }
    private void cancel(ExchangeRoom room, ExchangeOffer offer, Long userId) {
        var roomOrders = links.findByRoomIdOrderByIdAsc(room.getId()).stream().map(l -> orders.findById(l.getOrderId()).orElseThrow()).toList();
        if (roomOrders.stream().anyMatch(o -> Set.of(OrderStatus.SHIPPING, OrderStatus.DELIVERED, OrderStatus.COMPLETED).contains(o.getStatus())))
            throw error(HttpStatus.CONFLICT, "Không thể hủy khi một bên đã gửi hàng");
        if (room.getStatus() == ExchangeRoomStatus.CANCELLED) return;
        if (roomOrders.isEmpty()) {
            room.setStatus(ExchangeRoomStatus.CANCELLED); room.setClosedAt(LocalDateTime.now());
            return;
        }
        var quantities = new TreeMap<Long, Integer>(); quantities.put(room.getTargetProductId(), 1);
        offeredItems.findByOfferId(offer.getId()).forEach(i -> quantities.merge(i.getProductId(), i.getQuantity(), Integer::sum));
        for (var entry : quantities.entrySet()) {
            var p = products.lockForExchange(entry.getKey()).orElseThrow();
            p.setStockQuantity(p.getStockQuantity() + entry.getValue());
        }
        for (var order : roomOrders) {
            var previous = order.getStatus(); order.setStatus(OrderStatus.CANCELLED);
            order.setCancelledBy(userId); order.setCancelledAt(LocalDateTime.now());
            order.setCancelReason("Hủy giao dịch trao đổi trước khi gửi hàng"); order.setStockReleasedAt(LocalDateTime.now());
            payments.findByCheckoutId(order.getCheckoutId()).forEach(p -> p.setStatus(PaymentStatus.CANCELLED));
            record(order, previous, userId, order.getCancelReason());
        }
        room.setStatus(ExchangeRoomStatus.CANCELLED); room.setClosedAt(LocalDateTime.now());
    }
    private String code(String prefix) { return prefix + "-" + UUID.randomUUID().toString().substring(0, 18).toUpperCase(); }
    private void saveItem(Long orderId, Product p, String title, Integer condition, int quantity, BigDecimal price) {
        var item = new OrderItem(); item.setOrderId(orderId); item.setProductId(p.getId());
        item.setProductTitle(title); item.setImageUrl(p.getCoverImageUrl()); item.setConditionPercent(condition);
        item.setQuantity(quantity); item.setUnitPrice(price); items.save(item);
    }
    private void record(Order order, OrderStatus previous, Long userId, String note) {
        var event = new OrderStatusHistory(); event.setOrderId(order.getId()); event.setPreviousStatus(previous);
        event.setNewStatus(order.getStatus()); event.setChangedBy(userId); event.setNote(note); history.save(event);
    }
    private String name(Long userId) { return users.findById(userId).map(User::getFullName).orElse("Thành viên"); }
    private ExchangeOrderDTO dto(ExchangeOrderLink link) {
        var o = orders.findById(link.getOrderId()).orElseThrow();
        return new ExchangeOrderDTO(o.getId(), o.getOrderCode(), link.getRoomId(), link.getOfferId(),
            o.getBuyerId(), o.getSellerId(), name(o.getBuyerId()), name(o.getSellerId()), o.getStatus().name(),
            o.getPaymentStatus().name(), "COD", link.getShippingMethod(), o.getSubtotalAmount(), o.getShippingFee(), o.getTotalAmount(),
            o.getRecipientName(), o.getRecipientPhone(), o.getShippingAddress(), o.getBuyerNote(), o.getCreatedAt(),
            items.findByOrderId(o.getId()).stream().map(i -> new ExchangeOrderDTO.Item(i.getProductId(), i.getProductTitle(),
                i.getImageUrl(), i.getConditionPercent(), i.getQuantity())).toList());
    }
}
