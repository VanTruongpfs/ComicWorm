package com.example.comicworm.service.common;

public interface IEmailService {
    void sendVerificationEmail(String toEmail, String fullName, String verifyLink);
}