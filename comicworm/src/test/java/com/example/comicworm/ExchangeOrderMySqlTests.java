package com.example.comicworm;

import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.model.*;
import com.example.comicworm.model.enums.*;
import com.example.comicworm.repository.*;
import com.example.comicworm.service.exchange.*;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "EXCHANGE_MYSQL_TEST", matches = "true")
class ExchangeOrderMySqlTests {
    @Autowired IExchangeRoomService rooms;
    @Autowired ExchangeOrderService exchange;
    @Autowired AddressService addressService;
    @Autowired UserRepository users;
    @Autowired ProductRepository products;
    @Autowired CategoryRepository categories;
    @Autowired UserAddressRepository addresses;
    @Autowired ExchangeOrderLinkRepository links;
    @Autowired OrderRepository orders;
    @Autowired PaymentRepository payments;
    @Autowired OrderItemRepository items;
    @Autowired ExchangeRoomRepository roomRepository;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach void onlyDisposableDatabase() {
        String directory = System.getenv("EXCHANGE_MYSQL_DATADIR");
        assertNotNull(directory);
        assertEquals(Path.of(directory).toAbsolutePath().normalize(), Path.of(jdbc.queryForObject("select @@datadir", String.class)).toAbsolutePath().normalize());
    }
    record Fixture(Long host, Long buyer, Long target, Long traded, Long room, Long offer, Long hostAddress, Long buyerAddress) {}
    User user(String name) {
        var u = new User(); u.setFullName(name); u.setEmail(UUID.randomUUID() + "@exchange.invalid");
        u.setPasswordHash(encoder.encode("ExchangeTest2026!")); return users.save(u);
    }
    Product product(Long owner) {
        var p = new Product(); p.setSellerId(owner); p.setTitle("Truyện thật " + owner); p.setDescription("Mô tả từ MySQL");
        p.setSlug(UUID.randomUUID().toString()); p.setCategoryId(categories.findAll().getFirst().getId());
        p.setPrice(new BigDecimal("100000")); p.setStockQuantity(3); p.setConditionPercent(85);
        p.setModerationStatus(ModerationStatus.APPROVED); p.setListingType(ListingType.SELL_AND_TRADE); return products.save(p);
    }
    AddressRequest address(String name) { return new AddressRequest(name, "0901234567", "Hà Nội", "Ba Đình", "Phúc Xá", "12 Phố Kiểm Thử", true); }
    Fixture fixture(boolean trade, boolean hostPays) {
        var host = user("Chủ phòng"); var buyer = user("Người nhận");
        var p = product(host.getId()); var b = product(buyer.getId());
        var room = rooms.createOrGetRoomForProduct(buyer.getId(), p.getId(), "Xin trao đổi");
        var req = new CreateExchangeOfferRequest(); req.setCashCompensation(new BigDecimal("60000"));
        req.setCompensationDirection(hostPays ? "get" : "pay");
        req.setItems(trade ? List.of(new OfferItemInput(b.getId(), 1)) : List.of());
        var offer = rooms.proposeOffer(room.getId(), buyer.getId(), req);
        return new Fixture(host.getId(), buyer.getId(), p.getId(), b.getId(), room.getId(), offer.getId(),
            addressService.save(host.getId(), null, address("Chủ phòng")).id(), addressService.save(buyer.getId(), null, address("Người nhận")).id());
    }
    void agree(Fixture f) {
        rooms.respondToOffer(f.room, f.offer, f.host, true);
        rooms.confirmDeal(f.room, f.offer, f.host); rooms.confirmDeal(f.room, f.offer, f.buyer);
    }
    CreateExchangeOrderRequest request(Long id) { return new CreateExchangeOrderRequest(id, "STANDARD", "COD", "Ghi chú thật"); }

    @Test void persistsEditedOfferAndRejectsOtherOwnersAndClosedEdits() {
        var f = fixture(true, false);
        var update = new CreateExchangeOfferRequest(); update.setCashCompensation(new BigDecimal("70000"));
        update.setCompensationDirection("pay"); update.setItems(List.of(new OfferItemInput(f.traded, 2))); update.setNote("Đã sửa");
        assertThrows(ResponseStatusException.class, () -> rooms.updateOffer(f.room, f.offer, f.host, update));
        rooms.updateOffer(f.room, f.offer, f.buyer, update);
        var saved = rooms.getRoomDetail(f.room, f.buyer).getOffers().getFirst();
        assertEquals(0, saved.getCashCompensation().compareTo(new BigDecimal("70000")));
        assertEquals(2, saved.getItems().getFirst().getQuantity()); assertEquals("Đã sửa", saved.getNote());
        agree(f);
        assertThrows(ResponseStatusException.class, () -> rooms.updateOffer(f.room, f.offer, f.buyer, update));
    }
    @Test void createsTwoLegsWithSnapshotsCodAndOneTimeStockReservation() {
        var f = fixture(true, true); agree(f);
        var buyerOrder = exchange.create(f.room, f.buyer, request(f.buyerAddress));
        assertEquals(0, buyerOrder.subtotalAmount().signum()); assertEquals("PENDING", buyerOrder.paymentStatus());
        assertEquals(2, products.findById(f.target).orElseThrow().getStockQuantity());
        assertEquals(2, products.findById(f.traded).orElseThrow().getStockQuantity());
        assertThrows(ResponseStatusException.class, () -> exchange.updateStatus(buyerOrder.id(), f.host, "ACCEPT"));
        var hostOrder = exchange.create(f.room, f.host, request(f.hostAddress));
        assertEquals(0, hostOrder.subtotalAmount().compareTo(new BigDecimal("60000")));
        assertEquals(2, products.findById(f.traded).orElseThrow().getStockQuantity());
        assertEquals(2, exchange.checkout(f.room, f.host).orders().size());
        addressService.save(f.buyer, f.buyerAddress, address("Tên mới"));
        assertEquals("Người nhận", orders.findById(buyerOrder.id()).orElseThrow().getRecipientName());
        var payment = payments.findByCheckoutId(orders.findById(hostOrder.id()).orElseThrow().getCheckoutId()).getFirst();
        assertEquals(PaymentStatus.PENDING, payment.getStatus()); assertNull(payment.getPaidAt());
        exchange.updateStatus(buyerOrder.id(), f.host, "ACCEPT");
        exchange.updateStatus(buyerOrder.id(), f.host, "SHIP");
        assertThrows(ResponseStatusException.class, () -> exchange.updateStatus(hostOrder.id(), f.host, "CANCEL"));
        exchange.updateStatus(buyerOrder.id(), f.buyer, "RECEIVE");
        assertEquals(OrderPaymentStatus.PAID, orders.findById(buyerOrder.id()).orElseThrow().getPaymentStatus());
    }
    @Test void guardsConfirmationAddressOwnershipAndUnsupportedPayment() {
        var f = fixture(false, false);
        assertThrows(ResponseStatusException.class, () -> exchange.create(f.room, f.buyer, request(f.buyerAddress)));
        agree(f);
        assertThrows(ResponseStatusException.class, () -> exchange.create(f.room, f.buyer, request(f.hostAddress)));
        assertThrows(ResponseStatusException.class, () -> exchange.create(f.room, f.buyer, new CreateExchangeOrderRequest(f.buyerAddress, "STANDARD", "VIETQR", "")));
        assertThrows(ResponseStatusException.class, () -> exchange.create(f.room, f.host, request(f.hostAddress)));
        var stranger = user("Ngoài phòng");
        assertThrows(ResponseStatusException.class, () -> exchange.checkout(f.room, stranger.getId()));
        assertThrows(ResponseStatusException.class, () -> addressService.save(stranger.getId(), f.hostAddress, address("Xâm nhập")));
        var o = exchange.create(f.room, f.buyer, request(f.buyerAddress));
        assertEquals(1, exchange.checkout(f.room, f.buyer).requiredOrderCount());
        assertThrows(ResponseStatusException.class, () -> exchange.updateStatus(o.id(), f.buyer, "ACCEPT"));
    }
    @Test void cancellationReleasesBothLegsExactlyOnceEvenBeforeSecondOrder() {
        var f = fixture(true, false); agree(f);
        var o = exchange.create(f.room, f.buyer, request(f.buyerAddress));
        exchange.updateStatus(o.id(), f.host, "CANCEL"); exchange.updateStatus(o.id(), f.buyer, "CANCEL");
        assertEquals(3, products.findById(f.target).orElseThrow().getStockQuantity());
        assertEquals(3, products.findById(f.traded).orElseThrow().getStockQuantity());
        assertEquals(ExchangeRoomStatus.CANCELLED, roomRepository.findById(f.room).orElseThrow().getStatus());
        assertThrows(ResponseStatusException.class, () -> exchange.create(f.room, f.host, request(f.hostAddress)));
    }
    @Test void concurrentRetriesCreateOnlyOneOrder() throws Exception {
        var f = fixture(true, false); agree(f);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var gate = new CountDownLatch(1);
            Callable<Long> task = () -> { gate.await(); return exchange.create(f.room, f.buyer, request(f.buyerAddress)).id(); };
            var a = pool.submit(task); var b = pool.submit(task); gate.countDown();
            assertEquals(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
        }
        assertEquals(1, links.findByRoomIdOrderByIdAsc(f.room).size());
        assertEquals(2, products.findById(f.target).orElseThrow().getStockQuantity());
    }
    @Test void invalidSecondLegRollsBackReservationOfFirstLeg() {
        var f = fixture(true, false); agree(f);
        var p = products.findById(f.traded).orElseThrow(); p.setStockQuantity(0); products.save(p);
        assertThrows(ResponseStatusException.class, () -> exchange.create(f.room, f.buyer, request(f.buyerAddress)));
        assertEquals(3, products.findById(f.target).orElseThrow().getStockQuantity());
        assertTrue(links.findByRoomIdOrderByIdAsc(f.room).isEmpty());
    }
    @Test void cancellingBeforeAnyOrderDoesNotIncreaseStock() {
        var f = fixture(true, false); agree(f);
        exchange.cancelDeal(f.room, f.buyer); exchange.cancelDeal(f.room, f.host);
        assertEquals(3, products.findById(f.target).orElseThrow().getStockQuantity());
    }
    @Test void competingDealsCannotReserveLastCopyTwice() throws Exception {
        var f = fixture(false, false); agree(f);
        var target = products.findById(f.target).orElseThrow(); target.setStockQuantity(1); products.save(target);
        var other = user("Người mua thứ hai");
        var r = rooms.createOrGetRoomForProduct(other.getId(), f.target, "Mua bản cuối");
        var req = new CreateExchangeOfferRequest(); req.setCashCompensation(new BigDecimal("50000")); req.setCompensationDirection("pay");
        var offer = rooms.proposeOffer(r.getId(), other.getId(), req);
        rooms.respondToOffer(r.getId(), offer.getId(), f.host, true);
        rooms.confirmDeal(r.getId(), offer.getId(), f.host); rooms.confirmDeal(r.getId(), offer.getId(), other.getId());
        var address = addressService.save(other.getId(), null, address("Người mua thứ hai"));
        try (var pool = Executors.newFixedThreadPool(2)) {
            var gate = new CountDownLatch(1);
            var a = pool.submit(() -> { gate.await(); return exchange.create(f.room, f.buyer, request(f.buyerAddress)); });
            var b = pool.submit(() -> { gate.await(); return exchange.create(r.getId(), other.getId(), request(address.id())); });
            gate.countDown(); int successes = 0;
            for (var future : List.of(a, b)) {
                try { future.get(20, TimeUnit.SECONDS); successes++; }
                catch (ExecutionException ex) { assertInstanceOf(ResponseStatusException.class, ex.getCause()); }
            }
            assertEquals(1, successes);
        }
        assertEquals(0, products.findById(f.target).orElseThrow().getStockQuantity());
    }
    @Test void seedsBrowserAccounts() {
        for (String role : List.of("host", "buyer", "observer")) {
            var u = new User(); u.setEmail("exchange-" + role + "@example.invalid"); u.setFullName("Exchange " + role);
            u.setPasswordHash(encoder.encode("ExchangeTest2026!")); u = users.save(u);
            if (!role.equals("observer")) product(u.getId());
        }
    }
}
