package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeRoomMember;
import com.example.comicworm.model.id.ExchangeRoomMemberId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExchangeRoomMemberRepository extends JpaRepository<ExchangeRoomMember, ExchangeRoomMemberId> {
}
