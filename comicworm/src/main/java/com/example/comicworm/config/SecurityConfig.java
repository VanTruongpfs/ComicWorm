package com.example.comicworm.config;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import jakarta.servlet.DispatcherType;
import java.util.List;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.session.NullAuthenticatedSessionStrategy;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

import com.example.comicworm.config.oauth2.CustomOAuth2UserService;
import com.example.comicworm.config.oauth2.OAuth2LoginSuccessHandler;

@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CsrfTokenRepository csrfTokenRepository() {
        return new HttpSessionCsrfTokenRepository();
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            CsrfTokenRepository csrfTokens,
            @Autowired(required = false) ClientRegistrationRepository clientRegistrationRepository,
            @Autowired(required = false) OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler,
            @Autowired(required = false) CustomOAuth2UserService customOAuth2UserService) throws Exception {
        http
                .cors(cors -> cors.configurationSource(reportCors()))
                .csrf(csrf -> csrf.csrfTokenRepository(csrfTokens)
                        // Loading a JWT is not a new login. AuthController rotates CSRF on login/logout.
                        .sessionAuthenticationStrategy(new NullAuthenticatedSessionStrategy())
                        .requireCsrfProtectionMatcher(request -> {
                    String path = request.getRequestURI().substring(request.getContextPath().length());
                            return List.of("POST", "PUT", "PATCH", "DELETE").contains(request.getMethod())
                                    && (path.equals("/user/seller-upgrade") || path.startsWith("/api/account/")
                                    || (path.startsWith("/api/seller/") && !path.startsWith("/api/seller/tier/"))
                                    || (path.startsWith("/api/admin/") && !path.startsWith("/api/admin/seller-upgrades/")));
                }))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(authorize -> authorize
                        .dispatcherTypeMatchers(DispatcherType.ERROR, DispatcherType.FORWARD).permitAll()

                        // ---- Static Assets: Cho phép tải CSS, JS, hình ảnh ----
                        .requestMatchers(
                                "/", "/index.html", "/favicon.ico",
                                "/css/**", "/js/**", "/images/**",
                                "/admin/css/**", "/admin/js/**", "/admin/images/**",
                                "/seller/css/**", "/seller/js/**", "/seller/images/**",
                                "/buyer/css/**", "/buyer/js/**", "/buyer/images/**",
                                "/shared/**", "/uploads/**"
                        ).permitAll()

                        // ---- Khu vuc ADMIN: Bat buoc dang nhap + role ADMIN ----
                        .requestMatchers("/admin/html/login.html").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/analytics/admin").hasRole("ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/admin/**").hasRole("ADMIN")

                        // ---- Khu vuc SELLER: role SELLER hoac ADMIN ----
                        // ---- API Nang cap Nguoi ban: Cho phep moi User da dang nhap ----
                        .requestMatchers("/api/seller/tier/**").authenticated()

                        .requestMatchers(HttpMethod.GET, "/api/analytics/seller").hasRole("SELLER")
                        .requestMatchers("/api/seller/**").hasRole("SELLER")
                        .requestMatchers("/seller/**").hasRole("SELLER")
                        // ---- Khu vuc Nguoi dung can dang nhap ----
                        .requestMatchers("/user/seller-upgrade", "/user/html/profile.html", "/user/**").authenticated()
                        .requestMatchers("/api/account/**", "/api/loyalty/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/orders/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/orders/*/confirm-received").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/orders/*/cancel").authenticated()

                        // ---- Public API & Public Pages ----
                        .requestMatchers("/auth/**", "/api/auth/**", "/oauth2/**", "/login/oauth2/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/products/image-search").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/exchange/rooms", "/api/exchange/rooms/{id:[0-9]+}",
                                "/api/exchange/rooms/by-code/**", "/api/exchange/rooms/{id:[0-9]+}/messages").permitAll()
                        .requestMatchers("/api/cart/**", "/api/checkout/**").permitAll()
                        .requestMatchers("/ws/**", "/ws/exchange/**").permitAll()
                        .requestMatchers("/buyer/**", "/exchange/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/chat").permitAll()

                        .anyRequest().permitAll()
                )
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable);

        if (clientRegistrationRepository != null) {
            http.oauth2Login(oauth2 -> {
                oauth2.loginPage("/auth/login");
                if (customOAuth2UserService != null) {
                    oauth2.userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService));
                }
                if (oAuth2LoginSuccessHandler != null) {
                    oauth2.successHandler(oAuth2LoginSuccessHandler);
                }
                oauth2.failureHandler((request, response, exception) -> {
                    org.slf4j.LoggerFactory.getLogger(SecurityConfig.class)
                            .error("OAuth2 Login Failed: {}", exception.getMessage(), exception);
                    String detail = exception.getMessage() != null ? exception.getMessage() : "Đăng nhập Google thất bại.";
                    String errorMessage = java.net.URLEncoder.encode(
                            detail,
                            java.nio.charset.StandardCharsets.UTF_8
                    );
                    response.sendRedirect("/auth/login?oauthError=" + errorMessage);
                });
            });
        }

        http
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, error) -> {
                            if (isAccountPage(request.getRequestURI().substring(request.getContextPath().length()))) {
                                new LoginUrlAuthenticationEntryPoint("/auth/login").commence(request, response, error);
                            } else {
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED).commence(request, response, error);
                            }
                        })
                        .accessDeniedHandler((request, response, error) -> {
                            String uri = request.getRequestURI();
                            String msg = "Bạn không có quyền truy cập trang này (403 Forbidden).";
                            if (uri.contains("/admin/")) {
                                msg = "Tài khoản của bạn không có quyền Quản trị viên (ADMIN) để truy cập trang này.";
                            } else if (uri.contains("/seller/")) {
                                msg = "Tài khoản của bạn không có quyền Người bán (SELLER).";
                            }
                            response.sendError(HttpStatus.FORBIDDEN.value(), msg);
                        })
                )
                 .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
    private boolean isAccountPage(String path) {
        return path.startsWith("/seller/") || path.equals("/user/seller-upgrade")
                || path.equals("/user/html/profile.html") || path.startsWith("/admin/");
    }
    private UrlBasedCorsConfigurationSource reportCors() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5500", "http://127.0.0.1:5500",
                "http://localhost:5501", "http://127.0.0.1:5501"));
        config.setAllowedMethods(List.of("GET", "OPTIONS"));
        config.setAllowedHeaders(List.of("Accept", "Content-Type", "Authorization"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/analytics/**", config);
        CorsConfiguration account = new CorsConfiguration(config);
        account.setAllowedMethods(List.of("GET", "POST", "PUT", "OPTIONS"));
        account.setAllowedHeaders(List.of("Accept", "Content-Type", "Authorization", "X-CSRF-TOKEN"));
        source.registerCorsConfiguration("/api/account/**", account);
        CorsConfiguration products = new CorsConfiguration(config);
        products.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        products.setAllowedHeaders(List.of("Accept", "Content-Type", "Authorization", "X-CSRF-TOKEN"));
        source.registerCorsConfiguration("/api/seller/**", products);
        source.registerCorsConfiguration("/api/admin/**", products);
        return source;
    }

}
