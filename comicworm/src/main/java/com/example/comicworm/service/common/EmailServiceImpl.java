package com.example.comicworm.service.common;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Primary
@Service
public class EmailServiceImpl implements IEmailService {

    private final JavaMailSender mailSender;

    @org.springframework.beans.factory.annotation.Value("${spring.mail.username:vuivehoadong001@gmail.com}")
    private String fromEmail;

    @Autowired
    public EmailServiceImpl(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    @Async // Gửi email bất đồng bộ để tránh treo UI đăng ký
    public void sendVerificationEmail(String toEmail, String fullName, String verifyLink) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail, "ComicWorm");
            helper.setTo(toEmail);
            helper.setSubject("ComicWorm - Xác thực tài khoản của bạn");

            String htmlContent = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #4A90E2; text-align: center;">Chào mừng bạn đến với ComicWorm!</h2>
                    <p>Xin chào <strong>%s</strong>,</p>
                    <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng bấm vào nút bên dưới để kích hoạt tài khoản của mình:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="%s" style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Kích Hoạt Tài Khoản</a>
                    </div>
                    <p style="color: #777; font-size: 0.9em;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #aaa; font-size: 0.8em; text-align: center;">ComicWorm Team</p>
                </div>
            """.formatted(fullName, verifyLink);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            System.out.println("[EmailService] Đã gửi email xác thực tài khoản tới: " + toEmail);
        } catch (Exception e) {
            System.err.println("[EmailService] Không thể gửi email xác thực tới " + toEmail + ": " + e.getMessage());
            System.out.println("=================================================================");
            System.out.println("[DEV VERIFY ACCOUNT LINK FALLBACK] " + verifyLink);
            System.out.println("=================================================================");
        }
    }

    @Override
    @Async // Gửi email bất đồng bộ để tránh treo UI
    public void sendPasswordResetEmail(String toEmail, String fullName, String resetLink) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail, "ComicWorm");
            helper.setTo(toEmail);
            helper.setSubject("ComicWorm - Đặt lại mật khẩu tài khoản");

            String displayName = (fullName != null && !fullName.isBlank()) ? fullName : "Quý khách";
            String htmlContent = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h2 style="color: #9d4300; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px;">ComicWorm</h2>
                        <p style="color: #64748b; margin-top: 6px; font-size: 14px;">Nền tảng mua bán &amp; trao đổi truyện tranh</p>
                    </div>
                    <div style="padding: 20px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
                        <h3 style="color: #0f172a; margin-top: 0; font-size: 18px;">Yêu cầu đặt lại mật khẩu</h3>
                        <p style="color: #334155; line-height: 1.6;">Xin chào <strong>%s</strong>,</p>
                        <p style="color: #334155; line-height: 1.6;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ComicWorm của bạn.</p>
                        <p style="color: #334155; line-height: 1.6;">Vui lòng nhấn vào nút bên dưới để tiến hành tạo mật khẩu mới (liên kết này có hiệu lực trong vòng <strong>15 phút</strong>):</p>
                        <div style="text-align: center; margin: 28px 0;">
                            <a href="%s" style="background-color: #9d4300; color: #ffffff; padding: 13px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block; font-size: 15px;">Đặt lại mật khẩu</a>
                        </div>
                        <p style="color: #64748b; font-size: 13px; margin-bottom: 6px;">Nếu nút trên không bấm được, bạn có thể copy liên kết sau và dán vào trình duyệt:</p>
                        <p style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 6px; word-break: break-all; font-size: 12px; color: #475569;">%s</p>
                        <p style="color: #94a3b8; font-size: 13px; margin-top: 18px;">Nếu bạn không gửi yêu cầu này, hãy yên tâm bỏ qua email này. Mật khẩu hiện tại của bạn vẫn được bảo mật.</p>
                    </div>
                    <div style="text-align: center; padding-top: 18px; color: #94a3b8; font-size: 12px;">
                        <p style="margin: 0;">&copy; 2026 ComicWorm Team. Mọi quyền được bảo lưu.</p>
                    </div>
                </div>
            """.formatted(displayName, resetLink, resetLink);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            System.out.println("[EmailService] Đã gửi email đặt lại mật khẩu tới: " + toEmail);
        } catch (Exception e) {
            System.err.println("[EmailService] Không thể gửi email tới " + toEmail + ": " + e.getMessage());
            System.out.println("=================================================================");
            System.out.println("[DEV RESET PASSWORD LINK FALLBACK] " + resetLink);
            System.out.println("=================================================================");
        }
    }
}