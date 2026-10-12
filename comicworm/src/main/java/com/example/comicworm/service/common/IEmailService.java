package com.example.comicworm.service.common;

public interface IEmailService {
    void sendVerificationEmail(String toEmail, String fullName, String verifyLink);
    void sendPasswordResetEmail(String toEmail, String fullName, String resetLink);
}