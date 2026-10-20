package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeRoom;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExchangeRoomRepository extends JpaRepository<ExchangeRoom, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM ExchangeRoom r WHERE r.id = :id")
    Optional<ExchangeRoom> findByIdForUpdate(@Param("id") Long id);

    Optional<ExchangeRoom> findByRoomCode(String roomCode);

    Optional<ExchangeRoom> findFirstByTargetProductIdAndStatus(Long targetProductId, ExchangeRoomStatus status);

    List<ExchangeRoom> findByHostIdOrderByCreatedAtDesc(Long hostId);

    List<ExchangeRoom> findByStatusOrderByCreatedAtDesc(ExchangeRoomStatus status);

    @Query("""
        SELECT r FROM ExchangeRoom r
        LEFT JOIN Product p ON r.targetProductId = p.id
        WHERE (:status IS NULL OR r.status = :status)
          AND (:keyword IS NULL OR :keyword = ''
               OR LOWER(r.roomCode) LIKE LOWER(CONCAT('%', :keyword, '%'))
               OR LOWER(p.title) LIKE LOWER(CONCAT('%', :keyword, '%')))
        ORDER BY r.createdAt DESC
    """)
    List<ExchangeRoom> searchRooms(@Param("keyword") String keyword, @Param("status") ExchangeRoomStatus status);

    @Query("""
        SELECT DISTINCT r FROM ExchangeRoom r
        LEFT JOIN ExchangeRoomMember m ON r.id = m.roomId
        WHERE r.hostId = :userId OR m.userId = :userId
        ORDER BY r.createdAt DESC
    """)
    List<ExchangeRoom> findRoomsByUser(@Param("userId") Long userId);
}
