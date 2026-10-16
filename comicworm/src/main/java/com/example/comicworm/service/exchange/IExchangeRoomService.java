package com.example.comicworm.service.exchange;

import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
import java.util.List;

public interface IExchangeRoomService {

    ExchangeRoomDTO createOrGetRoomForProduct(Long currentUserId, Long targetProductId, String initialMessage);

    ExchangeRoomDTO getRoomDetail(Long roomId, Long currentUserId);

    ExchangeRoomDTO getRoomByCode(String roomCode, Long currentUserId);

    List<ExchangeRoomSummaryDTO> listRooms(String keyword, ExchangeRoomStatus status);

    List<ExchangeRoomSummaryDTO> listMyRooms(Long currentUserId);

    void joinRoom(Long roomId, Long currentUserId);

    ExchangeOfferDTO proposeOffer(Long roomId, Long buyerId, CreateExchangeOfferRequest req);
    ExchangeOfferDTO updateOffer(Long roomId, Long offerId, Long buyerId, CreateExchangeOfferRequest req);

    ExchangeOfferDTO respondToOffer(Long roomId, Long offerId, Long hostId, boolean accept);

    ExchangeOfferDTO confirmDeal(Long roomId, Long offerId, Long userId);

    void withdrawOffer(Long roomId, Long offerId, Long userId);

    void closeRoom(Long roomId, Long hostId);

    ExchangeMessageDTO sendMessage(Long roomId, Long senderId, SendExchangeMessageRequest req);

    List<ExchangeMessageDTO> getMessages(Long roomId, Long afterId);

    List<UserTradeProductDTO> getUserInventoryForTrade(Long userId);
}
