package com.example.comicworm.config.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * WebSocket Handler quản lý kết nối thời gian thực cho từng phòng trao đổi (Exchange Room).
 * Giúp người dùng trong cùng một phòng nhận được tin nhắn và sự kiện đề xuất tức thì mà không cần reload.
 */
@Slf4j
@Component
public class ExchangeChatWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;

    // Lưu danh sách WebSocketSession cho từng roomId: Map<roomId, Set<WebSocketSession>>
    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

    public ExchangeChatWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String roomKey = extractRoomKey(session);
        if (roomKey != null) {
            roomSessions.computeIfAbsent(roomKey, k -> ConcurrentHashMap.newKeySet()).add(session);
            log.info("[WebSocket] Session {} đã kết nối vào phòng trao đổi #{}", session.getId(), roomKey);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomKey = extractRoomKey(session);
        if (roomKey != null && roomSessions.containsKey(roomKey)) {
            roomSessions.get(roomKey).remove(session);
            if (roomSessions.get(roomKey).isEmpty()) {
                roomSessions.remove(roomKey);
            }
            log.info("[WebSocket] Session {} đã rời khỏi phòng trao đổi #{}", session.getId(), roomKey);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("[WebSocket] Lỗi kết nối session {}: {}", session.getId(), exception.getMessage());
    }

    /**
     * Phát sóng (broadcast) một sự kiện hoặc tin nhắn tới tất cả người dùng trong phòng trao đổi.
     *
     * @param roomId  ID của phòng trao đổi
     * @param payload Dữ liệu sự kiện hoặc tin nhắn (DTO/Object)
     */
    public void broadcast(Object roomId, Object payload) {
        if (roomId == null) return;
        String roomKey = String.valueOf(roomId);
        Set<WebSocketSession> sessions = roomSessions.getOrDefault(roomKey, Collections.emptySet());

        if (sessions.isEmpty()) {
            return;
        }

        try {
            String json = objectMapper.writeValueAsString(payload);
            TextMessage message = new TextMessage(json);

            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    synchronized (s) {
                        try {
                            s.sendMessage(message);
                        } catch (IOException e) {
                            log.error("[WebSocket] Gửi tin thất bại tới session {}: {}", s.getId(), e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("[WebSocket] Lỗi tuần tự hóa JSON khi broadcast vào phòng #{}: {}", roomKey, e.getMessage());
        }
    }

    private String extractRoomKey(WebSocketSession session) {
        if (session.getUri() == null) return null;
        String path = session.getUri().getPath();
        // Định dạng path: /ws/exchange/{roomId}
        String[] parts = path.split("/");
        if (parts.length > 0) {
            return parts[parts.length - 1];
        }
        return null;
    }
}
