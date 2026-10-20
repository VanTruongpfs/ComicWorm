package com.example.comicworm.dto.exchange;

import com.example.comicworm.model.UserAddress;

public record AddressDTO(Long id, String recipientName, String phone, String province,
        String district, String ward, String addressDetail, boolean isDefault) {
    public static AddressDTO from(UserAddress a) {
        return new AddressDTO(a.getId(), a.getRecipientName(), a.getPhone(), a.getProvince(),
            a.getDistrict(), a.getWard(), a.getAddressDetail(), a.isDefaultAddress());
    }
}
