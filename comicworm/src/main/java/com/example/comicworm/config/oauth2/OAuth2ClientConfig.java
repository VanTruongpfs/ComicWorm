package com.example.comicworm.config.oauth2;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;

@Configuration
public class OAuth2ClientConfig {

    @Value("${spring.security.oauth2.client.registration.google.client-id:${GOOGLE_CLIENT_ID:}}")
    private String clientId;

    @Value("${spring.security.oauth2.client.registration.google.client-secret:${GOOGLE_CLIENT_SECRET:}}")
    private String clientSecret;

    @Bean
    public ClientRegistrationRepository clientRegistrationRepository() {
        String effectiveClientId = (clientId != null && !clientId.isBlank())
                ? clientId.trim()
                : "google-client-id-placeholder";

        String effectiveClientSecret = (clientSecret != null && !clientSecret.isBlank())
                ? clientSecret.trim()
                : "google-client-secret-placeholder";

        ClientRegistration googleRegistration = CommonOAuth2Provider.GOOGLE.getBuilder("google")
                .clientId(effectiveClientId)
                .clientSecret(effectiveClientSecret)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .scope("openid", "profile", "email")
                .build();

        return new InMemoryClientRegistrationRepository(googleRegistration);
    }
}
