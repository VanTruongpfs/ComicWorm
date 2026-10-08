package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.service.analytics.AnalyticsService;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/analytics")
@Profile("!preview")
public class AnalyticsController {
    private final AnalyticsService service;
    public AnalyticsController(AnalyticsService service) { this.service = service; }
    @GetMapping("/seller")
    public Map<String, Object> seller(@RequestParam LocalDate from, @RequestParam LocalDate to,
            @RequestParam(defaultValue = "day") String grouping, @AuthenticationPrincipal CustomUserDetails user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!user.isSeller()) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return read(from, to, grouping, user.getId(), user.getFullName());
    }
    @GetMapping("/admin")
    public Map<String, Object> admin(@RequestParam LocalDate from, @RequestParam LocalDate to,
            @RequestParam(defaultValue = "day") String grouping, @AuthenticationPrincipal CustomUserDetails user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (user.getAuthorities().stream().noneMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN")))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return read(from, to, grouping, null, null);
    }
    private Map<String, Object> read(LocalDate from, LocalDate to, String grouping, Long sellerId, String name) {
        try { return service.report(from, to, grouping, sellerId, name); }
        catch (IllegalArgumentException error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage()); }
    }
}
