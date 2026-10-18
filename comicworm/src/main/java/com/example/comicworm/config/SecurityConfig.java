package com.example.comicworm.config;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import jakarta.servlet.DispatcherType;
import java.util.List;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
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
            OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler,
            CustomOAuth2UserService customOAuth2UserService) throws Exception {
        http
                .cors(cors -> cors.configurationSource(reportCors()))
                .csrf(csrf -> csrf.csrfTokenRepository(csrfTokens)
                        // Loading a JWT is not a new login. AuthController rotates CSRF on login/logout.
                        .sessionAuthenticationStrategy(new NullAuthenticatedSessionStrategy())
                        .requireCsrfProtectionMatcher(request -> {
                    String path = request.getRequestURI().substring(request.getContextPath().length());
                    return List.of("POST", "PUT", "PATCH", "DELETE").contains(request.getMethod())
                            && (path.equals("/user/seller-upgrade") || path.startsWith("/api/seller/")
                                    || path.startsWith("/api/admin/"));
                }))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(authorize -> authorize
                        .dispatcherTypeMatchers(DispatcherType.ERROR, DispatcherType.FORWARD).permitAll()

                        .requestMatchers(HttpMethod.GET, "/api/analytics/admin").hasRole("ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/analytics/seller").hasRole("SELLER")
                        .requestMatchers("/api/seller/**").hasRole("SELLER")
                        .requestMatchers("/seller/html/**").hasRole("SELLER")
                        // ---- Khu vuc ADMIN: bat buoc dang nhap + role ADMIN ----
                        .requestMatchers("/admin/html/login.html").permitAll() // chi redirect ve /auth/login
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/admin/html/**").hasRole("ADMIN")
                        .requestMatchers("/user/seller-upgrade", "/user/html/profile.html").authenticated()

                        //public API
                        .requestMatchers("/auth/**", "/api/auth/**", "/oauth2/**", "/login/oauth2/**").permitAll()
                        // API xem sản phẩm: công khai, chỉ đọc
                        .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/exchange/rooms", "/api/exchange/rooms/{id:[0-9]+}",
                                "/api/exchange/rooms/by-code/**", "/api/exchange/rooms/{id:[0-9]+}/messages").permitAll()
                        .requestMatchers("/api/cart/**", "/api/checkout/**").permitAll()
                        .requestMatchers("/ws/**", "/ws/exchange/**").permitAll()
                        .requestMatchers(
                                "/", "/index.html", "/favicon.ico",
                                "/css/**", "/js/**", "/images/**",
                                "/buyer/css/**", "/buyer/js/**", "/buyer/images/**",
                                "/buyer/**", "/seller/**", "/admin/**", "/auth/**", "/exchange/**", "/shared/**", "/user/**"
                        ).permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/", "/index.html", "/index.js", "/favicon.ico",
                                "/admin/**", "/auth/**", "/buyer/**", "/exchange/**",
                                "/seller/**", "/shared/**", "/user/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/chat").permitAll()
                        //Auth API, mai mốt API nào cần quyền/authorize thì cứ
                        //thêm vào là xong
                        .anyRequest().permitAll()
                )
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .oauth2Login(oauth2 -> oauth2
                        .loginPage("/auth/login")
                        .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                        .successHandler(oAuth2LoginSuccessHandler)
                        .failureHandler((request, response, exception) -> {
                            org.slf4j.LoggerFactory.getLogger(SecurityConfig.class)
                                    .error("OAuth2 Login Failed: {}", exception.getMessage(), exception);
                            String detail = exception.getMessage() != null ? exception.getMessage() : "Đăng nhập Google thất bại.";
                            String errorMessage = java.net.URLEncoder.encode(
                                    detail,
                                    java.nio.charset.StandardCharsets.UTF_8
                            );
                            response.sendRedirect("/auth/login?oauthError=" + errorMessage);
                        })
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, error) -> {
                            if (isAccountPage(request.getRequestURI().substring(request.getContextPath().length()))) {
                                new LoginUrlAuthenticationEntryPoint("/auth/login").commence(request, response, error);
                            } else {
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED).commence(request, response, error);
                            }
                        })
                        .accessDeniedHandler((request, response, error) -> {
                            response.sendError(HttpStatus.FORBIDDEN.value(), "Tài khoản của bạn không có quyền truy cập Kênh Người bán.");
                        })
                )
                 .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
    private boolean isAccountPage(String path) {
        return path.startsWith("/seller/html/") || path.equals("/user/seller-upgrade")
                || path.equals("/user/html/profile.html") || path.startsWith("/admin/html/");
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
        source.registerCorsConfiguration("/api/account/**", config);
        CorsConfiguration products = new CorsConfiguration(config);
        products.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        products.setAllowedHeaders(List.of("Accept", "Content-Type", "Authorization", "X-CSRF-TOKEN"));
        source.registerCorsConfiguration("/api/seller/**", products);
        source.registerCorsConfiguration("/api/admin/**", products);
        return source;
    }

}
