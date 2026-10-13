package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.exchange.ExchangeRoomController;
import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.ExchangeOfferStatus;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.exchange.IExchangeRoomService;
import com.example.comicworm.utils.JwtUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ExchangeRoomController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class ExchangeRoomControllerSecurityTests {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    IExchangeRoomService exchangeRoomService;

    @MockitoBean
    UserRepository userRepository;

    @MockitoBean
    UserDetailsService userDetailsService;

    @MockitoBean
    JwtUtils jwtUtils;

    private CustomUserDetails userPrincipal(Long id) {
        User u = new User();
        u.setId(id);
        u.setEmail("user" + id + "@comicworm.com");
        u.setFullName("User " + id);
        u.setRole(UserRole.USER);
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("Khách chưa đăng nhập có thể xem danh sách phòng công khai")
    void anonymous_canListRooms() throws Exception {
        ExchangeRoomSummaryDTO summary = ExchangeRoomSummaryDTO.builder()
                .id(1L)
                .roomCode("PT-101-1234")
                .targetProductId(101L)
                .targetProductTitle("One Piece")
                .status(ExchangeRoomStatus.OPEN)
                .build();

        when(exchangeRoomService.listRooms(any(), any())).thenReturn(List.of(summary));

        mvc.perform(get("/api/exchange/rooms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].roomCode").value("PT-101-1234"));
    }

    @Test
    @DisplayName("Khách chưa đăng nhập không thể tạo phòng trao đổi")
    void anonymous_cannotCreateRoom() throws Exception {
        mvc.perform(post("/api/exchange/rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetProductId\": 101}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Người dùng đã đăng nhập có thể tạo phòng trao đổi")
    void authenticatedUser_canCreateRoom() throws Exception {
        ExchangeRoomDTO room = ExchangeRoomDTO.builder()
                .id(1L)
                .roomCode("PT-101-5678")
                .hostId(10L)
                .targetProductId(101L)
                .status(ExchangeRoomStatus.OPEN)
                .build();

        when(exchangeRoomService.createOrGetRoomForProduct(eq(20L), eq(101L), any()))
                .thenReturn(room);

        mvc.perform(post("/api/exchange/rooms")
                        .with(user(userPrincipal(20L)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetProductId\": 101, \"initialMessage\": \"Xin chào\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.roomCode").value("PT-101-5678"));
    }

    @Test
    @DisplayName("Khách chưa đăng nhập không thể gửi đề xuất trao đổi")
    void anonymous_cannotProposeOffer() throws Exception {
        mvc.perform(post("/api/exchange/rooms/1/offers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cashCompensation\": 50000}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Người dùng đã đăng nhập có thể gửi đề xuất trao đổi")
    void authenticatedUser_canProposeOffer() throws Exception {
        ExchangeOfferDTO offer = ExchangeOfferDTO.builder()
                .id(99L)
                .roomId(1L)
                .buyerId(20L)
                .cashCompensation(new BigDecimal("50000"))
                .status(ExchangeOfferStatus.PENDING)
                .build();

        when(exchangeRoomService.proposeOffer(eq(1L), eq(20L), any()))
                .thenReturn(offer);

        mvc.perform(post("/api/exchange/rooms/1/offers")
                        .with(user(userPrincipal(20L)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cashCompensation\": 50000, \"compensationDirection\": \"pay\", \"items\": []}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(99))
                .andExpect(jsonPath("$.cashCompensation").value(50000));
    }

    @Test
    @DisplayName("Người dùng đã đăng nhập có thể gửi tin nhắn chat trong phòng")
    void authenticatedUser_canSendMessage() throws Exception {
        ExchangeMessageDTO msg = ExchangeMessageDTO.builder()
                .id(1001L)
                .roomId(1L)
                .senderId(20L)
                .content("Chào bạn, mình muốn thương lượng")
                .createdAt(LocalDateTime.now())
                .build();

        when(exchangeRoomService.sendMessage(eq(1L), eq(20L), any()))
                .thenReturn(msg);

        mvc.perform(post("/api/exchange/rooms/1/messages")
                        .with(user(userPrincipal(20L)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\": \"Chào bạn, mình muốn thương lượng\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1001))
                .andExpect(jsonPath("$.content").value("Chào bạn, mình muốn thương lượng"));
    }
}
