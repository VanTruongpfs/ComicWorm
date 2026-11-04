package com.example.comicworm.service.account;

import com.example.comicworm.dto.request.SellerApplicationForm;
import com.example.comicworm.dto.response.SellerApplicationDTO;
import com.example.comicworm.model.SellerApplication;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.SellerApplicationStatus;
import com.example.comicworm.repository.SellerApplicationRepository;
import com.example.comicworm.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Buyers apply to become sellers; an admin approves (turns on users.is_seller) or rejects with a reason. */
@Service
public class SellerApplicationService {
    private static final LocalDate EARLIEST_BIRTH_DATE = LocalDate.of(1900, 1, 1);
    private static final int MAX_REASON_LENGTH = 500;

    private final SellerApplicationRepository applications;
    private final UserRepository users;

    public SellerApplicationService(SellerApplicationRepository applications, UserRepository users) {
        this.applications = applications;
        this.users = users;
    }

    @Transactional
    public SellerApplicationDTO submit(Long userId, SellerApplicationForm form) {
        if (userId == null) throw error(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        // Lock the user row first so two concurrent submissions cannot both pass the pending check.
        User user = users.lockById(userId).orElseThrow(() -> error(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập."));
        if (user.getAccountStatus() != AccountStatus.ACTIVE) {
            throw error(HttpStatus.FORBIDDEN, "Tài khoản không ở trạng thái hoạt động.");
        }
        if (Boolean.TRUE.equals(user.getIsSeller())) throw error(HttpStatus.CONFLICT, "Tài khoản đã là Người bán.");
        if (applications.existsByUserIdAndStatus(userId, SellerApplicationStatus.PENDING)) {
            throw error(HttpStatus.CONFLICT, "Bạn đã có hồ sơ đang chờ duyệt.");
        }
        validateDates(form.idDateOfBirth(), form.idIssueDate());

        SellerApplication application = new SellerApplication();
        application.setUserId(userId);
        application.setStatus(SellerApplicationStatus.PENDING);
        application.setIdNumber(form.idNumber().trim());
        application.setIdFullName(form.idFullName().trim());
        application.setIdDateOfBirth(form.idDateOfBirth());
        application.setIdIssueDate(form.idIssueDate());
        application.setIdIssuePlace(form.idIssuePlace().trim());
        return toDto(applications.save(application), user);
    }

    @Transactional(readOnly = true)
    public Optional<SellerApplicationDTO> latestFor(Long userId) {
        if (userId == null) return Optional.empty();
        return applications.findFirstByUserIdOrderBySubmittedAtDescIdDesc(userId).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public List<SellerApplicationDTO> list(SellerApplicationStatus status) {
        return applications.findByStatusOrderBySubmittedAtDesc(status).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public SellerApplicationDTO get(Long id) {
        return toDto(applications.findById(id).orElseThrow(SellerApplicationService::notFound));
    }

    @Transactional
    public SellerApplicationDTO approve(Long adminId, Long id) {
        SellerApplication application = lockPending(id);
        User user = users.lockById(application.getUserId())
                .filter(u -> u.getAccountStatus() == AccountStatus.ACTIVE)
                .orElseThrow(() -> error(HttpStatus.CONFLICT, "Tài khoản người đăng ký đã bị khóa hoặc xóa."));
        markReviewed(application, adminId, SellerApplicationStatus.APPROVED, null);
        user.setIsSeller(true);
        users.save(user);
        return toDto(applications.save(application), user);
    }

    @Transactional
    public SellerApplicationDTO reject(Long adminId, Long id, String reason) {
        String note = reason == null ? "" : reason.trim();
        if (note.isEmpty()) throw error(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do từ chối.");
        if (note.length() > MAX_REASON_LENGTH) throw error(HttpStatus.BAD_REQUEST, "Lý do từ chối tối đa 500 ký tự.");
        SellerApplication application = lockPending(id);
        markReviewed(application, adminId, SellerApplicationStatus.REJECTED, note);
        return toDto(applications.save(application));
    }

    private SellerApplication lockPending(Long id) {
        SellerApplication application = applications.lockById(id).orElseThrow(SellerApplicationService::notFound);
        if (application.getStatus() != SellerApplicationStatus.PENDING) {
            throw error(HttpStatus.CONFLICT, "Hồ sơ đã được xử lý trước đó.");
        }
        return application;
    }

    private static void markReviewed(SellerApplication application, Long adminId,
                                     SellerApplicationStatus status, String note) {
        application.setStatus(status);
        application.setReviewedBy(adminId);
        application.setReviewedAt(LocalDateTime.now(ZoneOffset.UTC));
        application.setReviewNote(note);
    }

    private static void validateDates(LocalDate born, LocalDate issued) {
        LocalDate today = LocalDate.now();
        if (born.isBefore(EARLIEST_BIRTH_DATE) || born.isAfter(today)) {
            throw error(HttpStatus.BAD_REQUEST, "Ngày sinh không hợp lệ.");
        }
        if (born.plusYears(18).isAfter(today)) {
            throw error(HttpStatus.BAD_REQUEST, "Bạn cần đủ 18 tuổi để đăng ký bán hàng.");
        }
        if (issued.isAfter(today)) throw error(HttpStatus.BAD_REQUEST, "Ngày cấp không được ở tương lai.");
        if (!issued.isAfter(born)) throw error(HttpStatus.BAD_REQUEST, "Ngày cấp phải sau ngày sinh.");
    }

    private SellerApplicationDTO toDto(SellerApplication application) {
        return toDto(application, users.findById(application.getUserId()).orElse(null));
    }

    private static SellerApplicationDTO toDto(SellerApplication a, User user) {
        return new SellerApplicationDTO(a.getId(), a.getUserId(),
                user != null ? user.getFullName() : null, user != null ? user.getEmail() : null,
                a.getStatus().name(), a.getIdNumber(), a.getIdFullName(), a.getIdDateOfBirth(),
                a.getIdIssueDate(), a.getIdIssuePlace(), a.getSubmittedAt(), a.getReviewedAt(), a.getReviewNote());
    }

    private static ResponseStatusException notFound() {
        return error(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ đăng ký.");
    }

    private static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
