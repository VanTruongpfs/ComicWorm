package com.example.comicworm.service.exchange.impl;

import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.model.*;
import com.example.comicworm.model.enums.ExchangeOfferStatus;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
import com.example.comicworm.repository.*;
import com.example.comicworm.service.exchange.IExchangeRoomService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
@Profile("!preview")
@RequiredArgsConstructor
public class ExchangeRoomServiceImpl implements IExchangeRoomService {

    private final ExchangeRoomRepository exchangeRoomRepository;
    private final ExchangeRoomMemberRepository exchangeRoomMemberRepository;
    private final ExchangeOfferRepository exchangeOfferRepository;
    private final ExchangeOfferItemRepository exchangeOfferItemRepository;
    private final ExchangeMessageRepository exchangeMessageRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.comicworm.config.websocket.ExchangeChatWebSocketHandler webSocketHandler;

    @Override
    public ExchangeRoomDTO createOrGetRoomForProduct(Long currentUserId, Long targetProductId, String initialMessage) {
        Product product = productRepository.findById(targetProductId)
                .filter(p -> p.getDeletedAt() == null && Boolean.TRUE.equals(p.getIsActive()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sản phẩm trao đổi không tồn tại hoặc đã ngừng hoạt động"));

        Long hostId = product.getSellerId();

        // Kiểm tra xem đã có phòng đang mở (OPEN) cho sản phẩm này hay chưa
        Optional<ExchangeRoom> existingRoom = exchangeRoomRepository.findFirstByTargetProductIdAndStatus(targetProductId, ExchangeRoomStatus.OPEN);

        ExchangeRoom room;
        if (existingRoom.isPresent()) {
            room = existingRoom.get();
        } else {
            room = new ExchangeRoom();
            String code = generateRoomCode(product.getId());
            room.setRoomCode(code);
            room.setHostId(hostId);
            room.setTargetProductId(targetProductId);
            room.setStatus(ExchangeRoomStatus.OPEN);
            room = exchangeRoomRepository.save(room);

            // Host luôn là thành viên đầu tiên
            ensureMembership(room.getId(), hostId);

            // Tin nhắn mở phòng tự động
            ExchangeMessage welcome = new ExchangeMessage();
            welcome.setRoomId(room.getId());
            welcome.setSenderId(hostId);
            welcome.setContent("Phòng trao đổi giá được tạo · Giá niêm yết: " + formatPrice(product.getPrice())
                    + (product.getTradeWishNote() != null && !product.getTradeWishNote().isBlank()
                    ? " · Nhu cầu: " + product.getTradeWishNote() : ""));
            exchangeMessageRepository.save(welcome);
        }

        // Đảm bảo người dùng hiện tại là thành viên phòng
        if (currentUserId != null) {
            ensureMembership(room.getId(), currentUserId);
            if (initialMessage != null && !initialMessage.isBlank()) {
                ExchangeMessage msg = new ExchangeMessage();
                msg.setRoomId(room.getId());
                msg.setSenderId(currentUserId);
                msg.setContent(initialMessage.trim());
                exchangeMessageRepository.save(msg);
            }
        }

        return getRoomDetail(room.getId(), currentUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public ExchangeRoomDTO getRoomDetail(Long roomId, Long currentUserId) {
        ExchangeRoom room = exchangeRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng trao đổi #" + roomId));

        return buildRoomDTO(room, currentUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public ExchangeRoomDTO getRoomByCode(String roomCode, Long currentUserId) {
        ExchangeRoom room = exchangeRoomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng có mã " + roomCode));

        return buildRoomDTO(room, currentUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExchangeRoomSummaryDTO> listRooms(String keyword, ExchangeRoomStatus status) {
        List<ExchangeRoom> rooms = exchangeRoomRepository.searchRooms(
                keyword != null ? keyword.trim() : null,
                status
        );

        List<ExchangeRoomSummaryDTO> result = new ArrayList<>();
        for (ExchangeRoom r : rooms) {
            Product p = productRepository.findById(r.getTargetProductId()).orElse(null);
            User host = userRepository.findById(r.getHostId()).orElse(null);
            int memberCount = (int) exchangeRoomMemberRepository.countByRoomId(r.getId());
            int offerCount = (int) exchangeOfferRepository.countByRoomId(r.getId());

            result.add(ExchangeRoomSummaryDTO.builder()
                    .id(r.getId())
                    .roomCode(r.getRoomCode())
                    .hostId(r.getHostId())
                    .hostName(host != null ? host.getFullName() : "Chủ phòng")
                    .hostAvatar(host != null ? host.getAvatarUrl() : null)
                    .targetProductId(r.getTargetProductId())
                    .targetProductTitle(p != null ? p.getTitle() : "Sản phẩm #" + r.getTargetProductId())
                    .targetProductCover(p != null ? p.getCoverImageUrl() : null)
                    .targetProductPrice(p != null ? p.getPrice() : BigDecimal.ZERO)
                    .targetProductCondition(p != null ? p.getConditionPercent() : 100)
                    .targetProductWishNote(p != null ? p.getTradeWishNote() : null)
                    .status(r.getStatus())
                    .memberCount(memberCount)
                    .offerCount(offerCount)
                    .selectedOfferId(r.getSelectedOfferId())
                    .createdAt(r.getCreatedAt())
                    .build());
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExchangeRoomSummaryDTO> listMyRooms(Long currentUserId) {
        if (currentUserId == null) {
            return Collections.emptyList();
        }
        List<ExchangeRoom> rooms = exchangeRoomRepository.findRoomsByUser(currentUserId);
        List<ExchangeRoomSummaryDTO> result = new ArrayList<>();
        for (ExchangeRoom r : rooms) {
            Product p = productRepository.findById(r.getTargetProductId()).orElse(null);
            User host = userRepository.findById(r.getHostId()).orElse(null);
            int memberCount = (int) exchangeRoomMemberRepository.countByRoomId(r.getId());
            int offerCount = (int) exchangeOfferRepository.countByRoomId(r.getId());

            result.add(ExchangeRoomSummaryDTO.builder()
                    .id(r.getId())
                    .roomCode(r.getRoomCode())
                    .hostId(r.getHostId())
                    .hostName(host != null ? host.getFullName() : "Chủ phòng")
                    .hostAvatar(host != null ? host.getAvatarUrl() : null)
                    .targetProductId(r.getTargetProductId())
                    .targetProductTitle(p != null ? p.getTitle() : "Sản phẩm #" + r.getTargetProductId())
                    .targetProductCover(p != null ? p.getCoverImageUrl() : null)
                    .targetProductPrice(p != null ? p.getPrice() : BigDecimal.ZERO)
                    .targetProductCondition(p != null ? p.getConditionPercent() : 100)
                    .targetProductWishNote(p != null ? p.getTradeWishNote() : null)
                    .status(r.getStatus())
                    .memberCount(memberCount)
                    .offerCount(offerCount)
                    .selectedOfferId(r.getSelectedOfferId())
                    .createdAt(r.getCreatedAt())
                    .build());
        }
        return result;
    }

    @Override
    public void joinRoom(Long roomId, Long currentUserId) {
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để tham gia phòng");
        }
        ExchangeRoom room = exchangeRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng trao đổi"));

        if (room.getStatus() == ExchangeRoomStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phòng này đã đóng");
        }

        if (!exchangeRoomMemberRepository.existsByRoomIdAndUserId(roomId, currentUserId)) {
            ensureMembership(roomId, currentUserId);
            User u = userRepository.findById(currentUserId).orElse(null);
            ExchangeMessage joinMsg = new ExchangeMessage();
            joinMsg.setRoomId(roomId);
            joinMsg.setSenderId(currentUserId);
            joinMsg.setContent((u != null ? u.getFullName() : "Thành viên") + " đã tham gia phòng trao đổi.");
            exchangeMessageRepository.save(joinMsg);
        }
    }

    @Override
    public ExchangeOfferDTO proposeOffer(Long roomId, Long buyerId, CreateExchangeOfferRequest req) {
        if (buyerId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để gửi đề xuất");
        }

        ExchangeRoom room = exchangeRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng trao đổi"));

        if (room.getStatus() != ExchangeRoomStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phòng trao đổi hiện không ở trạng thái mở để nhận đề xuất mới");
        }

        if (room.getHostId().equals(buyerId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chủ phòng không thể tự gửi đề xuất trao đổi cho chính mình");
        }

        // Đảm bảo buyer là thành viên
        ensureMembership(roomId, buyerId);

        BigDecimal cash = req.getCashCompensation() != null ? req.getCashCompensation().abs() : BigDecimal.ZERO;
        Long payerId = null;

        if (cash.compareTo(BigDecimal.ZERO) > 0) {
            String dir = req.getCompensationDirection();
            if ("get".equalsIgnoreCase(dir)) {
                // Host bù cho buyer
                payerId = room.getHostId();
            } else {
                // Mặc định hoặc "pay": buyer bù cho host
                payerId = req.getCompensationPayerId() != null ? req.getCompensationPayerId() : buyerId;
            }
        }

        ExchangeOffer offer = new ExchangeOffer();
        offer.setRoomId(roomId);
        offer.setBuyerId(buyerId);
        offer.setCashCompensation(cash);
        offer.setCompensationPayerId(payerId);
        offer.setNote(req.getNote());
        offer.setStatus(ExchangeOfferStatus.PENDING);
        offer.setBuyerConfirmed(false);
        offer.setHostConfirmed(false);
        offer = exchangeOfferRepository.save(offer);

        List<ExchangeOfferItemDTO> itemDTOs = new ArrayList<>();
        if (req.getItems() != null && !req.getItems().isEmpty()) {
            for (OfferItemInput itemInput : req.getItems()) {
                if (itemInput.getProductId() == null) continue;
                Product p = productRepository.findById(itemInput.getProductId())
                        .filter(prod -> prod.getDeletedAt() == null)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Truyện đề xuất #" + itemInput.getProductId() + " không tồn tại"));

                if (p.getId().equals(room.getTargetProductId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể dùng chính bộ truyện của phòng để đề xuất trao đổi");
                }

                if (!p.getSellerId().equals(buyerId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bạn chỉ có thể đề xuất truyện thuộc quyền sở hữu của bạn: " + p.getTitle());
                }

                ExchangeOfferItem item = new ExchangeOfferItem();
                item.setOfferId(offer.getId());
                item.setProductId(p.getId());
                item.setOwnerId(buyerId);
                item.setQuantity(itemInput.getQuantity() != null && itemInput.getQuantity() > 0 ? itemInput.getQuantity() : 1);
                item.setTitleSnapshot(p.getTitle());
                item.setConditionSnapshot(p.getConditionPercent() != null ? p.getConditionPercent() : 100);
                item = exchangeOfferItemRepository.save(item);

                itemDTOs.add(ExchangeOfferItemDTO.builder()
                        .id(item.getId())
                        .productId(p.getId())
                        .ownerId(buyerId)
                        .quantity(item.getQuantity())
                        .titleSnapshot(item.getTitleSnapshot())
                        .conditionSnapshot(item.getConditionSnapshot())
                        .price(p.getPrice())
                        .coverImageUrl(p.getCoverImageUrl())
                        .build());
            }
        }

        // Tạo tin nhắn thông báo đề xuất trong chat
        User buyer = userRepository.findById(buyerId).orElse(null);
        String buyerName = buyer != null ? buyer.getFullName() : "Người mua";
        StringBuilder msgText = new StringBuilder();
        msgText.append(buyerName).append(" đã gửi đề xuất: ");
        if (!itemDTOs.isEmpty()) {
            msgText.append(itemDTOs.size()).append(" bộ truyện");
            if (cash.compareTo(BigDecimal.ZERO) > 0) {
                msgText.append(" + ");
            }
        }
        if (cash.compareTo(BigDecimal.ZERO) > 0) {
            if (Objects.equals(payerId, buyerId)) {
                msgText.append("bù thêm ").append(formatPrice(cash));
            } else {
                msgText.append("yêu cầu chủ phòng bù ").append(formatPrice(cash));
            }
        } else if (itemDTOs.isEmpty()) {
            msgText.append("đổi ngang không bù tiền");
        }
        if (req.getNote() != null && !req.getNote().isBlank()) {
            msgText.append(" (").append(req.getNote().trim()).append(")");
        }

        ExchangeMessage offerMsg = new ExchangeMessage();
        offerMsg.setRoomId(roomId);
        offerMsg.setSenderId(buyerId);
        offerMsg.setContent(msgText.toString());
        ExchangeMessage savedOfferMsg = exchangeMessageRepository.save(offerMsg);
        ExchangeMessage finalOfferMsg = savedOfferMsg != null ? savedOfferMsg : offerMsg;

        String dir = "none";
        if (cash.compareTo(BigDecimal.ZERO) > 0) {
            dir = Objects.equals(payerId, buyerId) ? "pay" : "get";
        }

        ExchangeOfferDTO offerDto = ExchangeOfferDTO.builder()
                .id(offer.getId())
                .roomId(roomId)
                .buyerId(buyerId)
                .buyerName(buyerName)
                .buyerAvatar(buyer != null ? buyer.getAvatarUrl() : null)
                .cashCompensation(cash)
                .compensationPayerId(payerId)
                .compensationDirection(dir)
                .note(offer.getNote())
                .status(offer.getStatus())
                .buyerConfirmed(offer.getBuyerConfirmed())
                .hostConfirmed(offer.getHostConfirmed())
                .createdAt(offer.getCreatedAt())
                .respondedAt(offer.getRespondedAt())
                .items(itemDTOs)
                .build();

        Map<String, Object> offerEvent = new HashMap<>();
        offerEvent.put("type", "OFFER_PROPOSED");
        offerEvent.put("roomId", roomId);
        offerEvent.put("offer", offerDto);
        offerEvent.put("message", ExchangeMessageDTO.builder()
                .id(finalOfferMsg.getId())
                .roomId(roomId)
                .senderId(buyerId)
                .senderName(buyerName)
                .senderAvatar(buyer != null ? buyer.getAvatarUrl() : null)
                .isHost(buyerId.equals(room.getHostId()))
                .content(finalOfferMsg.getContent())
                .createdAt(finalOfferMsg.getCreatedAt() != null ? finalOfferMsg.getCreatedAt() : LocalDateTime.now())
                .build());
        broadcastToRoom(roomId, room.getRoomCode(), offerEvent);

        return offerDto;
    }

    @Override
    public ExchangeOfferDTO respondToOffer(Long roomId, Long offerId, Long hostId, boolean accept) {
        ExchangeRoom room = exchangeRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng trao đổi"));

        if (!room.getHostId().equals(hostId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ chủ phòng mới có quyền chấp nhận hoặc từ chối đề xuất");
        }

        ExchangeOffer offer = exchangeOfferRepository.findByIdAndRoomId(offerId, roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề xuất #" + offerId + " trong phòng này"));

        if (offer.getStatus() != ExchangeOfferStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đề xuất này đã được xử lý từ trước");
        }

        offer.setRespondedAt(LocalDateTime.now());
        ExchangeMessage resMsg;

        if (accept) {
            offer.setStatus(ExchangeOfferStatus.ACCEPTED);
            offer.setHostConfirmed(true);

            // Chuyển phòng sang trạng thái đã đồng ý (AGREED) và gán offer được chọn
            room.setStatus(ExchangeRoomStatus.AGREED);
            room.setSelectedOfferId(offer.getId());

            ExchangeMessage acceptMsg = new ExchangeMessage();
            acceptMsg.setRoomId(roomId);
            acceptMsg.setSenderId(hostId);
            acceptMsg.setContent("Chủ phòng đã chấp thuận đề xuất #" + offer.getId() + "! Hai bên có thể tiến hành chốt và tạo đơn trao đổi.");
            ExchangeMessage saved = exchangeMessageRepository.save(acceptMsg);
            resMsg = saved != null ? saved : acceptMsg;
        } else {
            offer.setStatus(ExchangeOfferStatus.DECLINED);

            ExchangeMessage declineMsg = new ExchangeMessage();
            declineMsg.setRoomId(roomId);
            declineMsg.setSenderId(hostId);
            declineMsg.setContent("Chủ phòng đã từ chối đề xuất #" + offer.getId() + ".");
            ExchangeMessage saved = exchangeMessageRepository.save(declineMsg);
            resMsg = saved != null ? saved : declineMsg;
        }

        exchangeOfferRepository.save(offer);
        exchangeRoomRepository.save(room);

        ExchangeOfferDTO offerDto = toOfferDTO(offer);

        Map<String, Object> resEvent = new HashMap<>();
        resEvent.put("type", accept ? "OFFER_ACCEPTED" : "OFFER_DECLINED");
        resEvent.put("roomId", roomId);
        resEvent.put("offerId", offerId);
        resEvent.put("offer", offerDto);
        resEvent.put("roomStatus", room.getStatus().name());
        resEvent.put("message", ExchangeMessageDTO.builder()
                .id(resMsg != null ? resMsg.getId() : null)
                .roomId(roomId)
                .senderId(hostId)
                .senderName(userRepository.findById(hostId).map(User::getFullName).orElse("Chủ phòng"))
                .isHost(true)
                .content(resMsg != null ? resMsg.getContent() : "")
                .createdAt(resMsg != null && resMsg.getCreatedAt() != null ? resMsg.getCreatedAt() : LocalDateTime.now())
                .build());
        broadcastToRoom(roomId, room.getRoomCode(), resEvent);

        return offerDto;
    }

    @Override
    public ExchangeOfferDTO confirmDeal(Long roomId, Long offerId, Long userId) {
        ExchangeRoom room = exchangeRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng trao đổi"));

        ExchangeOffer offer = exchangeOfferRepository.findByIdAndRoomId(offerId, roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề xuất"));

        if (offer.getStatus() != ExchangeOfferStatus.ACCEPTED && offer.getStatus() != ExchangeOfferStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ có thể chốt đề xuất đã được chấp thuận hoặc hợp lệ");
        }

        if (userId.equals(room.getHostId())) {
            offer.setHostConfirmed(true);
        } else if (userId.equals(offer.getBuyerId())) {
            offer.setBuyerConfirmed(true);
        } else {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không phải là chủ phòng hoặc người đề xuất thỏa thuận này");
        }

        ExchangeMessage completeMsg = null;
        // Nếu cả hai đã xác nhận -> chuyển trạng thái phòng
        if (Boolean.TRUE.equals(offer.getHostConfirmed()) && Boolean.TRUE.equals(offer.getBuyerConfirmed())) {
            room.setStatus(ExchangeRoomStatus.COMPLETED);
            room.setClosedAt(LocalDateTime.now());
            room.setSelectedOfferId(offer.getId());
            exchangeRoomRepository.save(room);

            ExchangeMessage msg = new ExchangeMessage();
            msg.setRoomId(roomId);
            msg.setSenderId(userId);
            msg.setContent("Hai bên đã xác nhận chốt thỏa thuận thành công! Đang chuyển sang bước hoàn tất đơn hàng trao đổi.");
            ExchangeMessage saved = exchangeMessageRepository.save(msg);
            completeMsg = saved != null ? saved : msg;
        }

        exchangeOfferRepository.save(offer);
        ExchangeOfferDTO offerDto = toOfferDTO(offer);

        Map<String, Object> dealEvent = new HashMap<>();
        dealEvent.put("type", "DEAL_CONFIRMED");
        dealEvent.put("roomId", roomId);
        dealEvent.put("offerId", offerId);
        dealEvent.put("offer", offerDto);
        dealEvent.put("roomStatus", room.getStatus().name());
        if (completeMsg != null) {
            dealEvent.put("message", ExchangeMessageDTO.builder()
                    .id(completeMsg.getId())
                    .roomId(roomId)
                    .senderId(userId)
                    .senderName(userRepository.findById(userId).map(User::getFullName).orElse("Thành viên"))
                    .isHost(userId.equals(room.getHostId()))
                    .content(completeMsg.getContent())
                    .createdAt(completeMsg.getCreatedAt() != null ? completeMsg.getCreatedAt() : LocalDateTime.now())
                    .build());
        }
        broadcastToRoom(roomId, room.getRoomCode(), dealEvent);

        return offerDto;
    }

    @Override
    public void withdrawOffer(Long roomId, Long offerId, Long userId) {
        ExchangeOffer offer = exchangeOfferRepository.findByIdAndRoomId(offerId, roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề xuất"));

        if (!offer.getBuyerId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chỉ có thể rút đề xuất do chính mình tạo ra");
        }

        if (offer.getStatus() != ExchangeOfferStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ có thể rút đề xuất đang chờ xử lý");
        }

        offer.setStatus(ExchangeOfferStatus.WITHDRAWN);
        offer.setRespondedAt(LocalDateTime.now());
        exchangeOfferRepository.save(offer);

        ExchangeMessage msg = new ExchangeMessage();
        msg.setRoomId(roomId);
        msg.setSenderId(userId);
        msg.setContent("Người đề xuất đã rút lại đề xuất #" + offerId + ".");
        ExchangeMessage savedMsg = exchangeMessageRepository.save(msg);
        ExchangeMessage finalMsg = savedMsg != null ? savedMsg : msg;

        Map<String, Object> withdrawEvent = new HashMap<>();
        withdrawEvent.put("type", "OFFER_WITHDRAWN");
        withdrawEvent.put("roomId", roomId);
        withdrawEvent.put("offerId", offerId);
        withdrawEvent.put("message", ExchangeMessageDTO.builder()
                .id(finalMsg.getId())
                .roomId(roomId)
                .senderId(userId)
                .senderName(userRepository.findById(userId).map(User::getFullName).orElse("Thành viên"))
                .isHost(false)
                .content(finalMsg.getContent())
                .createdAt(finalMsg.getCreatedAt() != null ? finalMsg.getCreatedAt() : LocalDateTime.now())
                .build());
        broadcastToRoom(roomId, null, withdrawEvent);
    }

    @Override
    public void closeRoom(Long roomId, Long hostId) {
        ExchangeRoom room = exchangeRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng trao đổi"));

        if (!room.getHostId().equals(hostId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ chủ phòng mới có thể đóng phòng trao đổi");
        }

        room.setStatus(ExchangeRoomStatus.CANCELLED);
        room.setClosedAt(LocalDateTime.now());
        exchangeRoomRepository.save(room);

        ExchangeMessage msg = new ExchangeMessage();
        msg.setRoomId(roomId);
        msg.setSenderId(hostId);
        msg.setContent("Chủ phòng đã đóng phòng trao đổi này.");
        ExchangeMessage savedMsg = exchangeMessageRepository.save(msg);
        ExchangeMessage finalMsg = savedMsg != null ? savedMsg : msg;

        Map<String, Object> closeEvent = new HashMap<>();
        closeEvent.put("type", "ROOM_CLOSED");
        closeEvent.put("roomId", roomId);
        closeEvent.put("roomStatus", ExchangeRoomStatus.CANCELLED.name());
        closeEvent.put("message", ExchangeMessageDTO.builder()
                .id(finalMsg.getId())
                .roomId(roomId)
                .senderId(hostId)
                .senderName("Chủ phòng")
                .isHost(true)
                .content(finalMsg.getContent())
                .createdAt(finalMsg.getCreatedAt() != null ? finalMsg.getCreatedAt() : LocalDateTime.now())
                .build());
        broadcastToRoom(roomId, room.getRoomCode(), closeEvent);
    }

    @Override
    public ExchangeMessageDTO sendMessage(Long roomId, Long senderId, SendExchangeMessageRequest req) {
        if (senderId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để gửi tin nhắn");
        }

        if ((req.getContent() == null || req.getContent().isBlank()) && (req.getImageUrl() == null || req.getImageUrl().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nội dung tin nhắn không được để trống");
        }

        ExchangeRoom room = exchangeRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng trao đổi"));

        if (room.getStatus() == ExchangeRoomStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phòng trao đổi đã đóng");
        }

        ensureMembership(roomId, senderId);

        ExchangeMessage message = new ExchangeMessage();
        message.setRoomId(roomId);
        message.setSenderId(senderId);
        message.setContent(req.getContent() != null ? req.getContent().trim() : null);
        message.setImageUrl(req.getImageUrl());
        message.setClientMessageKey(req.getClientMessageKey());
        ExchangeMessage savedMessage = exchangeMessageRepository.save(message);
        ExchangeMessage finalMsg = savedMessage != null ? savedMessage : message;

        User sender = userRepository.findById(senderId).orElse(null);

        ExchangeMessageDTO dto = ExchangeMessageDTO.builder()
                .id(finalMsg.getId())
                .roomId(roomId)
                .senderId(senderId)
                .senderName(sender != null ? sender.getFullName() : "Thành viên")
                .senderAvatar(sender != null ? sender.getAvatarUrl() : null)
                .isHost(senderId.equals(room.getHostId()))
                .content(finalMsg.getContent())
                .imageUrl(finalMsg.getImageUrl())
                .clientMessageKey(finalMsg.getClientMessageKey())
                .createdAt(finalMsg.getCreatedAt() != null ? finalMsg.getCreatedAt() : LocalDateTime.now())
                .build();

        Map<String, Object> chatEvent = new HashMap<>();
        chatEvent.put("type", "CHAT_MESSAGE");
        chatEvent.put("roomId", roomId);
        chatEvent.put("message", dto);
        broadcastToRoom(roomId, room.getRoomCode(), chatEvent);
        broadcastToRoom(roomId, room.getRoomCode(), dto);

        return dto;
    }

    private void broadcastToRoom(Long roomId, String roomCode, Object payload) {
        if (webSocketHandler != null) {
            if (roomId != null) {
                webSocketHandler.broadcast(roomId, payload);
            }
            if (roomCode != null && !roomCode.isBlank()) {
                webSocketHandler.broadcast(roomCode, payload);
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExchangeMessageDTO> getMessages(Long roomId, Long afterId) {
        ExchangeRoom room = exchangeRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng trao đổi"));

        List<ExchangeMessage> messages;
        if (afterId != null && afterId > 0) {
            messages = exchangeMessageRepository.findByRoomIdAndIdGreaterThanOrderByCreatedAtAsc(roomId, afterId);
        } else {
            messages = exchangeMessageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
        }

        Map<Long, User> userCache = new HashMap<>();
        List<ExchangeMessageDTO> result = new ArrayList<>();

        for (ExchangeMessage m : messages) {
            User sender = userCache.computeIfAbsent(m.getSenderId(), id -> userRepository.findById(id).orElse(null));
            result.add(ExchangeMessageDTO.builder()
                    .id(m.getId())
                    .roomId(roomId)
                    .senderId(m.getSenderId())
                    .senderName(sender != null ? sender.getFullName() : "Thành viên")
                    .senderAvatar(sender != null ? sender.getAvatarUrl() : null)
                    .isHost(m.getSenderId().equals(room.getHostId()))
                    .content(m.getContent())
                    .imageUrl(m.getImageUrl())
                    .clientMessageKey(m.getClientMessageKey())
                    .createdAt(m.getCreatedAt())
                    .build());
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserTradeProductDTO> getUserInventoryForTrade(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        List<Product> products = productRepository.findBySellerIdAndIsActiveTrueAndDeletedAtIsNullOrderByCreatedAtDesc(userId);
        List<UserTradeProductDTO> result = new ArrayList<>();
        for (Product p : products) {
            result.add(UserTradeProductDTO.builder()
                    .id(p.getId())
                    .title(p.getTitle())
                    .volumeNumbers(p.getVolumeNumbers())
                    .conditionPercent(p.getConditionPercent())
                    .price(p.getPrice())
                    .coverImageUrl(p.getCoverImageUrl())
                    .build());
        }
        return result;
    }

    // ==========================================
    // HELPERS
    // ==========================================

    private void ensureMembership(Long roomId, Long userId) {
        if (!exchangeRoomMemberRepository.existsByRoomIdAndUserId(roomId, userId)) {
            ExchangeRoomMember member = new ExchangeRoomMember();
            member.setRoomId(roomId);
            member.setUserId(userId);
            exchangeRoomMemberRepository.save(member);
        }
    }

    private String generateRoomCode(Long productId) {
        return "PT-" + productId + "-" + (int) (Math.random() * 9000 + 1000);
    }

    private String formatPrice(BigDecimal price) {
        if (price == null) return "0₫";
        return String.format("%,d₫", price.longValue());
    }

    private ExchangeRoomDTO buildRoomDTO(ExchangeRoom room, Long currentUserId) {
        Product targetProduct = productRepository.findById(room.getTargetProductId()).orElse(null);
        User host = userRepository.findById(room.getHostId()).orElse(null);

        // Members
        List<ExchangeRoomMember> memberList = exchangeRoomMemberRepository.findByRoomIdOrderByJoinedAtAsc(room.getId());
        List<ExchangeMemberDTO> memberDTOs = new ArrayList<>();
        boolean isCurrentMember = false;

        for (ExchangeRoomMember m : memberList) {
            User u = userRepository.findById(m.getUserId()).orElse(null);
            boolean isHost = m.getUserId().equals(room.getHostId());
            if (currentUserId != null && m.getUserId().equals(currentUserId)) {
                isCurrentMember = true;
            }
            memberDTOs.add(ExchangeMemberDTO.builder()
                    .userId(m.getUserId())
                    .fullName(u != null ? u.getFullName() : "Thành viên #" + m.getUserId())
                    .avatarUrl(u != null ? u.getAvatarUrl() : null)
                    .isHost(isHost)
                    .joinedAt(m.getJoinedAt())
                    .build());
        }

        // Offers
        List<ExchangeOffer> offers = exchangeOfferRepository.findByRoomIdOrderByCreatedAtDesc(room.getId());
        List<ExchangeOfferDTO> offerDTOs = new ArrayList<>();
        for (ExchangeOffer off : offers) {
            offerDTOs.add(toOfferDTO(off));
        }

        boolean isHost = currentUserId != null && room.getHostId().equals(currentUserId);

        return ExchangeRoomDTO.builder()
                .id(room.getId())
                .roomCode(room.getRoomCode())
                .hostId(room.getHostId())
                .hostName(host != null ? host.getFullName() : "Chủ phòng")
                .hostAvatar(host != null ? host.getAvatarUrl() : null)
                .hostEmail(host != null ? host.getEmail() : null)
                .targetProductId(room.getTargetProductId())
                .targetProductTitle(targetProduct != null ? targetProduct.getTitle() : "Sản phẩm #" + room.getTargetProductId())
                .targetProductCover(targetProduct != null ? targetProduct.getCoverImageUrl() : null)
                .targetProductPrice(targetProduct != null ? targetProduct.getPrice() : BigDecimal.ZERO)
                .targetProductCondition(targetProduct != null ? targetProduct.getConditionPercent() : 100)
                .targetProductListingType(targetProduct != null && targetProduct.getListingType() != null ? targetProduct.getListingType().name() : "TRADE")
                .targetProductWishNote(targetProduct != null ? targetProduct.getTradeWishNote() : null)
                .targetProductVolumeNumbers(targetProduct != null ? targetProduct.getVolumeNumbers() : null)
                .targetProductPublisher(targetProduct != null && targetProduct.getPublisher() != null ? targetProduct.getPublisher().getName() : null)
                .targetProductAuthor(targetProduct != null && targetProduct.getAuthor() != null ? targetProduct.getAuthor().getName() : null)
                .selectedOfferId(room.getSelectedOfferId())
                .status(room.getStatus())
                .createdAt(room.getCreatedAt())
                .closedAt(room.getClosedAt())
                .isCurrentUserHost(isHost)
                .isCurrentUserMember(isCurrentMember || isHost)
                .currentUserId(currentUserId)
                .members(memberDTOs)
                .offers(offerDTOs)
                .build();
    }

    private ExchangeOfferDTO toOfferDTO(ExchangeOffer off) {
        User buyer = userRepository.findById(off.getBuyerId()).orElse(null);
        List<ExchangeOfferItem> items = exchangeOfferItemRepository.findByOfferId(off.getId());
        List<ExchangeOfferItemDTO> itemDTOs = new ArrayList<>();

        for (ExchangeOfferItem it : items) {
            Product p = productRepository.findById(it.getProductId()).orElse(null);
            itemDTOs.add(ExchangeOfferItemDTO.builder()
                    .id(it.getId())
                    .productId(it.getProductId())
                    .ownerId(it.getOwnerId())
                    .quantity(it.getQuantity())
                    .titleSnapshot(it.getTitleSnapshot())
                    .conditionSnapshot(it.getConditionSnapshot())
                    .price(p != null ? p.getPrice() : BigDecimal.ZERO)
                    .coverImageUrl(p != null ? p.getCoverImageUrl() : null)
                    .build());
        }

        String dir = "none";
        if (off.getCashCompensation() != null && off.getCashCompensation().compareTo(BigDecimal.ZERO) > 0) {
            dir = (off.getCompensationPayerId() == null || Objects.equals(off.getCompensationPayerId(), off.getBuyerId())) ? "pay" : "get";
        }

        return ExchangeOfferDTO.builder()
                .id(off.getId())
                .roomId(off.getRoomId())
                .buyerId(off.getBuyerId())
                .buyerName(buyer != null ? buyer.getFullName() : "Người mua")
                .buyerAvatar(buyer != null ? buyer.getAvatarUrl() : null)
                .cashCompensation(off.getCashCompensation())
                .compensationPayerId(off.getCompensationPayerId())
                .compensationDirection(dir)
                .note(off.getNote())
                .status(off.getStatus())
                .buyerConfirmed(off.getBuyerConfirmed())
                .hostConfirmed(off.getHostConfirmed())
                .createdAt(off.getCreatedAt())
                .respondedAt(off.getRespondedAt())
                .items(itemDTOs)
                .build();
    }
}
