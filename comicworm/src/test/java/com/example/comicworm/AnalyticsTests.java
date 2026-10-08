package com.example.comicworm;

import com.example.comicworm.controller.AnalyticsController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.service.analytics.AnalyticsReportBuilder;
import com.example.comicworm.service.analytics.AnalyticsService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AnalyticsTests {
    final LocalDate from = LocalDate.of(2026, 10, 1), to = LocalDate.of(2026, 10, 3);
    AnalyticsReportBuilder.Line line(long order, long seller, String day, long product, String price, long quantity) {
        return new AnalyticsReportBuilder.Line(order, seller, "Shop " + seller, LocalDate.parse(day), product,
                "Truyện " + product, "Shounen", new BigDecimal(price), quantity, 10);
    }
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> rows(Map<String, Object> result, String key) { return (List<Map<String, Object>>) result.get(key); }
    @Test void snapshotsKeepExactMoneyInclusiveDatesAndDistinctOrders() {
        var report = AnalyticsReportBuilder.build(List.of(line(1,1,"2026-10-01",5,"65000.10",2),
            line(1,1,"2026-10-01",5,"40000.20",1), line(2,1,"2026-10-03",6,"50000.00",1),
            line(3,1,"2026-09-30",5,"990000",1), line(4,1,"2026-10-04",5,"990000",1)), from,to,"day");
        assertEquals(new BigDecimal("220000.40"), report.get("revenue"));
        assertEquals(2, report.get("orders")); assertEquals(4L, report.get("units"));
        assertEquals(1, rows(report,"products").get(0).get("orders"));
        assertEquals(0, rows(report,"series").get(1).get("orders"));
    }
    @Test void bucketsKeepZeroDaysAndClipWeeksAndMonths() {
        var week = AnalyticsReportBuilder.build(List.of(line(1,1,"2026-10-03",5,"60000",1)),from,to,"week");
        assertEquals(1, rows(week,"series").size()); assertEquals("2026-10-01", rows(week,"series").get(0).get("from"));
        assertEquals("2026-10-03", rows(week,"series").get(0).get("to"));
        var months = AnalyticsReportBuilder.build(List.of(),from,LocalDate.of(2026,11,2),"month");
        assertEquals(2, rows(months,"series").size()); assertEquals("2026-11-02", rows(months,"series").get(1).get("to"));
    }
    @Test void breakdownsMatchMoneyAndUnitsWithoutFabricatingCampaignOrGeography() {
        var report = AnalyticsReportBuilder.build(List.of(line(1,1,"2026-10-01",5,"49999",2),
                line(2,2,"2026-10-02",5,"50000",1),line(3,1,"2026-10-03",6,"200000",1)),from,to,"day");
        for (String key : List.of("categories","campaigns","priceTiers","regions","cities","sellers")) {
            assertEquals(report.get("revenue"), rows(report,key).stream().map(row -> (BigDecimal)row.get("value")).reduce(BigDecimal.ZERO,BigDecimal::add),key);
            assertEquals(report.get("units"),rows(report,key).stream().mapToLong(row -> ((Number)row.get("units")).longValue()).sum(),key);
        }
        assertEquals(3, rows(report,"products").size());
        assertEquals("Không gắn chiến dịch",rows(report,"campaigns").get(0).get("label"));
        assertEquals("Chưa xác định khu vực",rows(report,"regions").get(0).get("label"));
        assertEquals("DATABASE",report.get("source"));
    }
    @Test void invalidDatesAndGroupingFailBeforeLoading() {
        assertThrows(IllegalArgumentException.class,()->AnalyticsReportBuilder.build(List.of(),to,from,"day"));
        assertThrows(IllegalArgumentException.class,()->AnalyticsReportBuilder.build(List.of(),from,from.plusDays(3660),"day"));
        assertThrows(IllegalArgumentException.class,()->AnalyticsReportBuilder.build(List.of(),from,to,"unknown"));
    }
    CustomUserDetails user(long id, UserRole role, boolean seller) {
        User user = new User(); user.setId(id); user.setFullName("Shop " + id); user.setRole(role); user.setIsSeller(seller);
        return new CustomUserDetails(user);
    }
    @Test void sellerScopeIsTakenFromAuthenticatedUserOnly() {
        var service=mock(AnalyticsService.class); var controller=new AnalyticsController(service);
        controller.seller(from,to,"day",user(17,UserRole.USER,true));
        verify(service).report(from,to,"day",17L,"Shop 17");
    }
    @Test void adminIsRequiredForAllSellerData() {
        var service=mock(AnalyticsService.class); var controller=new AnalyticsController(service);
        assertEquals(403,assertThrows(ResponseStatusException.class,()->controller.admin(from,to,"day",user(17,UserRole.USER,true))).getStatusCode().value());
        verifyNoInteractions(service);
        controller.admin(from,to,"day",user(1,UserRole.ADMIN,false)); verify(service).report(from,to,"day",null,null);
    }
    @Test void anonymousAndBuyerRequestsCannotReadRevenue() {
        var service=mock(AnalyticsService.class); var controller=new AnalyticsController(service);
        assertEquals(401,assertThrows(ResponseStatusException.class,()->controller.seller(from,to,"day",null)).getStatusCode().value());
        assertEquals(403,assertThrows(ResponseStatusException.class,()->controller.seller(from,to,"day",user(3,UserRole.USER,false))).getStatusCode().value());
        verifyNoInteractions(service);
    }
}
