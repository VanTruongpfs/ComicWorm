package com.example.comicworm.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "user_addresses")
@Getter @Setter
public class UserAddress {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long userId;
    @Column(nullable = false, length = 100) private String recipientName;
    @Column(nullable = false, length = 20) private String phone;
    @Column(nullable = false, length = 100) private String province;
    @Column(nullable = false, length = 100) private String district;
    @Column(nullable = false, length = 100) private String ward;
    @Column(nullable = false, length = 500) private String addressDetail;
    @Column(nullable = false) private boolean defaultAddress;
}
