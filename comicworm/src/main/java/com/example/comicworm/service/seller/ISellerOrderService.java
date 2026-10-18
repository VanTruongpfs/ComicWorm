package com.example.comicworm.service.seller;

import com.example.comicworm.dto.response.SellerOrderDetailRecord;
import com.example.comicworm.dto.response.SellerOrderStatsRecord;

import java.util.Map;

public interface ISellerOrderService {

    Map<String, Object> listOrders(Long sellerId, String filter, String keyword, String sort, int page, int size);

    SellerOrderStatsRecord getStats(Long sellerId);

    SellerOrderDetailRecord getOrderDetail(Long sellerId, Long orderId);

    SellerOrderDetailRecord updateStatus(Long sellerId, Long orderId, String newStatusStr, String note);

    SellerOrderDetailRecord cancelOrder(Long sellerId, Long orderId, String reason);
}

