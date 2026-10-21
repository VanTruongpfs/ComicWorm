package com.example.comicworm.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration(proxyBeanMethods = false)
public class ImageSearchSchedulingConfig {
    @Bean
    @Primary
    public ThreadPoolTaskScheduler taskScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("scheduling-");
        scheduler.setDaemon(true);
        return scheduler;
    }

    @Bean
    public ThreadPoolTaskScheduler imageSearchScheduler() {
        // Model inference must not delay payment expiry or other scheduled business jobs.
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("image-index-");
        scheduler.setDaemon(true);
        return scheduler;
    }
}
