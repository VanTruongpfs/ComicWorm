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

@Configuration(proxyBeanMethods = false)
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
    SecurityFilterChain securityFilterChain(HttpSecurity http, CsrfTokenRepository csrfTokens) throws Exception {
        http
                .cors(cors -> cors.configurationSource(reportCors()))
                .csrf(csrf -> csrf.csrfTokenRepository(csrfTokens)
                        // Loading a JWT is not a new login. AuthController rotates CSRF on login/logout.
                        .sessionAuthenticationStrategy(new NullAuthenticatedSessionStrategy())
                        .requireCsrfProtectionMatcher(request -> {
                    String path = request.getRequestURI().substring(request.getContextPath().length());
                    return List.of("POST", "PUT", "PATCH", "DELETE").contains(request.getMethod())
                            && (path.equals("/user/seller-upgrade") || path.startsWith("/api/seller/"));
                }))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .dispatcherTypeMatchers(DispatcherType.ERROR, DispatcherType.FORWARD).permitAll()

                        .requestMatchers(HttpMethod.GET, "/api/analytics/admin").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/analytics/seller").hasRole("SELLER")
                        .requestMatchers("/api/seller/**").hasRole("SELLER")
                        .requestMatchers("/seller/html/**").hasRole("SELLER")
                        .requestMatchers("/admin/html/statistics.html").hasRole("ADMIN")
                        .requestMatchers("/user/seller-upgrade", "/user/html/profile.html").authenticated()

                        //public API
                        .requestMatchers(HttpMethod.POST, "/auth/**").permitAll()
                        // API xem sản phẩm: công khai, chỉ đọc
                        .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                        .requestMatchers("/api/cart/**", "/api/checkout/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/", "/index.html", "/index.js", "/favicon.ico",
                                "/admin/**", "/auth/**", "/buyer/**", "/exchange/**",
                                "/seller/**", "/shared/**", "/user/**",
                                "/css/**", "/js/**", "/images/**").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/", "/index.html", "/index.js", "/favicon.ico",
                                "/admin/**", "/auth/**", "/buyer/**", "/exchange/**",
                                "/seller/**", "/shared/**", "/user/**").permitAll()

                        //Auth API, mai mốt API nào cần quyền/authorize thì cứ
                        //thêm vào là xong
                        .anyRequest().authenticated()
                )
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, error) -> {
                            if (isAccountPage(request.getRequestURI().substring(request.getContextPath().length()))) {
                                new LoginUrlAuthenticationEntryPoint("/auth/login").commence(request, response, error);
                            } else {
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED).commence(request, response, error);
                            }
                        })
                        .accessDeniedHandler((request, response, error) -> {
                            String path = request.getRequestURI().substring(request.getContextPath().length());
                            if (error instanceof CsrfException && path.equals("/user/seller-upgrade")) {
                                response.sendRedirect(request.getContextPath() + "/user/seller-upgrade?csrfExpired=true");
                            } else if (path.startsWith("/seller/html/")) {
                                response.sendRedirect(request.getContextPath() + "/user/seller-upgrade");
                            } else {
                                response.sendError(HttpStatus.FORBIDDEN.value());
                            }
                        })
                )
                 .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
    private boolean isAccountPage(String path) {
        return path.startsWith("/seller/html/") || path.equals("/user/seller-upgrade")
                || path.equals("/user/html/profile.html") || path.equals("/admin/html/statistics.html");
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
        return source;
    }

}
