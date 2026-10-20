package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeRoomMember;
import com.example.comicworm.model.id.ExchangeRoomMemberId;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExchangeRoomMemberRepository extends JpaRepository<ExchangeRoomMember, ExchangeRoomMemberId> {

    List<ExchangeRoomMember> findByRoomIdOrderByJoinedAtAsc(Long roomId);

    Optional<ExchangeRoomMember> findByRoomIdAndUserId(Long roomId, Long userId);

    boolean existsByRoomIdAndUserId(Long roomId, Long userId);

    List<ExchangeRoomMember> findByUserId(Long userId);

    long countByRoomId(Long roomId);
}
