package com.example.comicworm.service.exchange;

import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.model.UserAddress;
import com.example.comicworm.repository.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @Profile("!preview") @RequiredArgsConstructor @Transactional
public class AddressService {
    private final UserAddressRepository addresses;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public List<AddressDTO> list(Long userId) {
        return addresses.findByUserIdOrderByDefaultAddressDescIdDesc(userId).stream().map(AddressDTO::from).toList();
    }

    public AddressDTO save(Long userId, Long id, AddressRequest request) {
        users.lockById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var existing = addresses.findByUserIdOrderByDefaultAddressDescIdDesc(userId);
        UserAddress address = id == null ? new UserAddress() : addresses.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy địa chỉ của bạn"));
        boolean makeDefault = request.isDefault() || existing.isEmpty() || address.isDefaultAddress();
        if (makeDefault) existing.forEach(a -> a.setDefaultAddress(false));
        address.setUserId(userId);
        address.setRecipientName(request.recipientName().trim());
        address.setPhone(request.phone().trim());
        address.setProvince(request.province().trim());
        address.setDistrict(request.district().trim());
        address.setWard(request.ward().trim());
        address.setAddressDetail(request.addressDetail().trim());
        address.setDefaultAddress(makeDefault);
        return AddressDTO.from(addresses.save(address));
    }

    public void delete(Long userId, Long id) {
        users.lockById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var address = addresses.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy địa chỉ của bạn"));
        addresses.delete(address);
        addresses.flush();
        if (address.isDefaultAddress()) addresses.findByUserIdOrderByDefaultAddressDescIdDesc(userId).stream()
            .findFirst().ifPresent(a -> a.setDefaultAddress(true));
    }
}
