package com.example.comicworm.repository;

import com.example.comicworm.model.UserAddress;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAddressRepository extends JpaRepository<UserAddress, Long> {
    List<UserAddress> findByUserIdOrderByDefaultAddressDescIdDesc(Long userId);
    Optional<UserAddress> findByIdAndUserId(Long id, Long userId);
}
