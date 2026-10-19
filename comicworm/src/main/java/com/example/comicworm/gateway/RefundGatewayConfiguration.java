package com.example.comicworm.gateway;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("!preview")
public class RefundGatewayConfiguration {

    @Bean
    @ConditionalOnMissingBean(RefundGateway.class)
    public RefundGateway mockRefundGateway() {
        return new MockRefundGateway();
    }
}
