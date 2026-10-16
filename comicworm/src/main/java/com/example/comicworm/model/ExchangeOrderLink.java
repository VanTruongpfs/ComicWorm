package com.example.comicworm.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "exchange_order_links", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"room_id", "recipient_id"}),
    @UniqueConstraint(columnNames = "order_id")
})
@Getter @Setter
public class ExchangeOrderLink {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long roomId;
    @Column(nullable = false) private Long offerId;
    @Column(nullable = false) private Long recipientId;
    @Column(nullable = false) private Long orderId;
    @Column(nullable = false, length = 30) private String shippingMethod;
}
