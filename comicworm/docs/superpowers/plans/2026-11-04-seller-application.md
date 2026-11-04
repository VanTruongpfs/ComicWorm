# Đăng ký mở bán bằng CCCD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người mua gửi hồ sơ CCCD (dữ liệu mẫu) để đăng ký mở bán; admin duyệt thì bật `users.is_seller`, từ chối thì kèm lý do và người dùng gửi lại được.

**Architecture:** Bảng mới `seller_applications` + entity/repository; `SellerApplicationService` chứa toàn bộ quy tắc (gửi, duyệt, từ chối) và thay thế `SellerUpgradeService`. Trang người dùng `/user/seller-upgrade` (nhãn "Đăng ký Người bán") render Thymeleaf theo trạng thái; admin dùng REST API mới dưới `/api/admin/seller-applications`, hiển thị trong tab "Quản lý đăng ký người bán" có sẵn của trang Quản lý tài khoản (đang là mock UI).

**Tech Stack:** Spring Boot 3.5.6, Java 21, Spring Data JPA, Spring Security (cookie JWT, CSRF theo đường dẫn), Thymeleaf, MySQL, JUnit 5 + Mockito + `@WebMvcTest`; schema sinh bằng `database/schema_model.py`.

**Spec:** `docs/superpowers/specs/2026-11-04-seller-application-design.md`

## Global Constraints

- Chạy mọi lệnh từ `comicworm/`; Windows/PowerShell.
- Controller trả DTO, không trả entity. Ghi khóa ngoại qua trường ID (`setUserId`, `setReviewedBy`).
- Thời gian lưu UTC: dùng `LocalDateTime.now(ZoneOffset.UTC)`.
- Trạng thái hồ sơ: đúng ba giá trị `PENDING`, `APPROVED`, `REJECTED`.
- Lý do từ chối: bắt buộc, sau khi trim dài 1–500 ký tự.
- CCCD: đúng 12 chữ số; họ tên ≤ 100 ký tự; nơi cấp ≤ 200 ký tự; đủ 18 tuổi; ngày sinh không trước 1900-01-01; ngày cấp không ở tương lai và sau ngày sinh.
- Dữ liệu mẫu điền sẵn: `001099012345`, `NGUYỄN VĂN MẪU`, `1999-01-01`, `2021-06-15`, `Cục Cảnh sát quản lý hành chính về trật tự xã hội`.
- Không tải lên hay lưu ảnh CCCD; hai ảnh mẫu SVG chỉ để hiển thị.
- KHÔNG chạy `python database/build_schema.py` trước khi Task 1 Step 1 đưa thay đổi bảng `reviews` vào `schema_model.py` (lệnh này ghi đè `schema.sql` và làm mất cột `product_quality_rating`, `seller_attitude_rating`). Script không có `--help`; gọi là chạy thật.
- Mốc test: 297 test, 13 hỏng sẵn có (`AccountProfileTests` ×6, `ComicwormApplicationTests` ×3, `ProductModerationTests` ×2, `SellerAccessTests` ×2). Sau mỗi task không được có test hỏng mới; sau Task 3 hai test `SellerAccessTests` phải pass.

## Review Focus

1. Người dùng bấm "Gửi hồ sơ" hai lần (hai tab) → chỉ một hồ sơ `PENDING`, lần sau nhận lỗi 409 dễ hiểu. Test: Task 2 `submitLocksTheUserRowBeforeCheckingPending`.
2. Tài khoản bị khóa trong lúc hồ sơ đang chờ, admin vẫn bấm Duyệt → 409, không bật quyền. Test: Task 2 `approveRejectsLockedOrDeletedUser`.
3. Ô ngày bị sửa thành chuỗi sai định dạng (gửi tay) → form hiện lại kèm lỗi, không phải trang 500. Test: Task 3 `malformedDateShowsFieldErrorInsteadOf500`.
4. Admin nhập lý do từ chối chỉ toàn khoảng trắng → 400 với thông báo. Test: Task 4 `rejectWithBlankReasonReturns400`.
5. Admin mở hồ sơ đã được admin khác xử lý rồi bấm Duyệt/Từ chối → 409, trang hiển thị thông báo và tải lại danh sách. Test: Task 2 `approveOrRejectNonPendingConflicts` (service) + kiểm tra tay ở Task 5 Step 3.

---

### Task 1: Bảng `seller_applications`, entity và repository

**Files:**
- Modify: `database/schema_model.py` (bảng `reviews` quanh dòng 228; thêm bảng mới sau `password_reset_tokens`)
- Regenerate: `database/schema.sql`, `database/bookmooch.dbml`, `database/bookmooch.grouped.dbml`
- Create: `database/migrations/20261104_seller_applications.sql`
- Create: `src/main/java/com/example/comicworm/model/enums/SellerApplicationStatus.java`
- Create: `src/main/java/com/example/comicworm/model/SellerApplication.java`
- Create: `src/main/java/com/example/comicworm/repository/SellerApplicationRepository.java`
- Modify: `docs/new-machine-setup.md` (thêm bước chạy migration trước khi khởi động app)
- Modify: `CLAUDE.md` (`schema.sql` có 35 bảng)

**Interfaces:**
- Produces: `enum SellerApplicationStatus { PENDING, APPROVED, REJECTED }`
- Produces: entity `SellerApplication` với các trường `Long id, Long userId, SellerApplicationStatus status, String idNumber, String idFullName, LocalDate idDateOfBirth, LocalDate idIssueDate, String idIssuePlace, LocalDateTime submittedAt, Long reviewedBy, LocalDateTime reviewedAt, String reviewNote` (Lombok `@Getter @Setter @NoArgsConstructor`, `status` là `@Enumerated(STRING)`).
- Produces: `SellerApplicationRepository extends JpaRepository<SellerApplication, Long>` với:
  - `Optional<SellerApplication> findFirstByUserIdOrderBySubmittedAtDescIdDesc(Long userId)`
  - `boolean existsByUserIdAndStatus(Long userId, SellerApplicationStatus status)`
  - `List<SellerApplication> findByStatusOrderBySubmittedAtDesc(SellerApplicationStatus status)`
  - `@Lock(PESSIMISTIC_WRITE) @Query("select a from SellerApplication a where a.id = :id") Optional<SellerApplication> lockById(@Param("id") Long id)`

- [ ] **Step 1: Đưa thay đổi bảng `reviews` vào `schema_model.py`**

Thêm sau dòng `rating int [...]`:
```
product_quality_rating int
seller_attitude_rating int
```

- [ ] **Step 2: Chạy build và xác nhận `schema.sql` không đổi**

Run: `python database/build_schema.py; git diff --stat -- database/`
Expected: in `34 tables, ...`; `git diff` không có thay đổi nào ở `schema.sql` (nếu DBML đổi thứ tự cột của `reviews` thì chấp nhận được, `schema.sql` phải giống hệt).

- [ ] **Step 3: Thêm bảng `seller_applications` vào `schema_model.py`** (nhóm `tg_auth`)

```
table('seller_applications', '''
id bigint [pk, not null, increment]
user_id bigint [not null]
status varchar(20) [not null, default: 'PENDING', check: `status IN ('PENDING', 'APPROVED', 'REJECTED')`]
id_number char(12) [not null]
id_full_name varchar(100) [not null]
id_date_of_birth date [not null]
id_issue_date date [not null]
id_issue_place varchar(200) [not null]
submitted_at timestamp [not null, default: `CURRENT_TIMESTAMP`]
reviewed_by bigint
reviewed_at datetime
review_note varchar(500)
''', 'tg_auth')
fk('seller_applications', 'user_id', 'users')
fk('seller_applications', 'reviewed_by', 'users')
index('seller_applications', 'status,submitted_at', key='idx_seller_application_status')
index('seller_applications', 'user_id,submitted_at', key='idx_seller_application_user')
check('seller_applications', 'ck_seller_application_reject_note', "status <> 'REJECTED' OR review_note IS NOT NULL")
note('seller_applications', 'Hồ sơ đăng ký mở bán. CCCD là dữ liệu mẫu để demo; không lưu ảnh.')
```

- [ ] **Step 4: Sinh lại schema và kiểm tra**

Run: `python database/build_schema.py; git diff -- database/schema.sql`
Expected: `35 tables`; diff chỉ thêm khối `CREATE TABLE seller_applications` cùng FK/index/check của nó.
Run: `python database/verify_mysql.py --mysql-bin "D:\wampp\bin\mysql\mysql8.4.7\bin"`
Expected: kết thúc không lỗi.

- [ ] **Step 5: Viết migration `20261104_seller_applications.sql`**

Nội dung: khối `CREATE TABLE IF NOT EXISTS` sao chép từ `schema.sql` vừa sinh (kèm FK, index, CHECK). Đầu file chú thích: nếu Hibernate đã tạo bảng (thiếu CHECK) và bảng còn rỗng thì `DROP TABLE seller_applications;` rồi chạy lại file.

- [ ] **Step 6: Tạo enum, entity, repository** theo khối Interfaces. Entity theo kiểu `ExchangeRoom.java` (`@Table(name = "seller_applications")`, cột `snake_case`, `submittedAt` map giống `ExchangeMessage.createdAt`: `@CreationTimestamp @Column(name = "submitted_at", nullable = false, columnDefinition = "timestamp", updatable = false)`).

- [ ] **Step 7: Biên dịch và chạy toàn bộ test**

Run: `.\gradlew.bat test --console=plain`
Expected: 297 test, 13 hỏng như mốc.

- [ ] **Step 8: Áp migration vào DB local**

Run: `& "D:\wampp\bin\mysql\mysql8.4.7\bin\mysql.exe" -u<user> -p<pass> bookmooch_db_v3 -e "source database/migrations/20261104_seller_applications.sql"` (lấy user/pass từ `application-local.properties`).
Expected: `SHOW CREATE TABLE seller_applications` có `ck_seller_application_reject_note`.

- [ ] **Step 9: Cập nhật `docs/new-machine-setup.md` và `CLAUDE.md`, rồi commit**

```bash
git add database/ src/main/java/com/example/comicworm/model/ src/main/java/com/example/comicworm/repository/SellerApplicationRepository.java docs/new-machine-setup.md CLAUDE.md
git commit -m "feat(seller): add seller_applications table, entity and repository"
```

---

### Task 2: `SellerApplicationService`

**Files:**
- Create: `src/main/java/com/example/comicworm/service/account/SellerApplicationService.java`
- Create: `src/main/java/com/example/comicworm/dto/request/SellerApplicationForm.java`
- Create: `src/main/java/com/example/comicworm/dto/response/SellerApplicationDTO.java`
- Delete: `src/main/java/com/example/comicworm/service/account/SellerUpgradeService.java`
- Modify: `src/test/java/com/example/comicworm/SellerAccessTests.java:46` (đổi `SellerUpgradeService.class` trong `@Import` thành `SellerApplicationService.class`, thêm `@MockitoBean SellerApplicationRepository`)
- Test: `src/test/java/com/example/comicworm/SellerApplicationServiceTests.java`

**Interfaces:**
- Consumes: Task 1 (entity, enum, repository); `UserRepository.lockById(Long)`, `UserRepository.findById(Long)`; `User.getIsSeller()`, `getAccountStatus()`, `getDeletedAt()`, `getFullName()`, `getEmail()`.
- Produces:
  - `record SellerApplicationForm(@NotBlank @Pattern(regexp="\\d{12}") String idNumber, @NotBlank @Size(max=100) String idFullName, @NotNull LocalDate idDateOfBirth, @NotNull LocalDate idIssueDate, @NotBlank @Size(max=200) String idIssuePlace)` với `static SellerApplicationForm sample()` trả dữ liệu mẫu ở Global Constraints. Thông báo lỗi tiếng Việt trong `message`.
  - `record SellerApplicationDTO(Long id, Long userId, String userFullName, String userEmail, String status, String idNumber, String idFullName, LocalDate idDateOfBirth, LocalDate idIssueDate, String idIssuePlace, LocalDateTime submittedAt, LocalDateTime reviewedAt, String reviewNote)`
  - `SellerApplicationService`:
    - `SellerApplicationDTO submit(Long userId, SellerApplicationForm form)` — 401 nếu `userId` null; khóa user bằng `lockById` (không thấy → 401); 403 nếu không `ACTIVE`; 409 nếu đã là Người bán hoặc đã có hồ sơ `PENDING`; kiểm tra ngày (400, `ResponseStatusException` với lý do tiếng Việt); trim chuỗi; lưu `PENDING`.
    - `Optional<SellerApplicationDTO> latestFor(Long userId)`
    - `List<SellerApplicationDTO> list(SellerApplicationStatus status)`
    - `SellerApplicationDTO get(Long id)` — 404 nếu không có.
    - `SellerApplicationDTO approve(Long adminId, Long id)` — `lockById` hồ sơ (404), 409 nếu không `PENDING`; khóa user (`lockById`), 409 nếu user không còn hoặc không `ACTIVE`; đặt `APPROVED`, `reviewedBy`, `reviewedAt`, `user.setIsSeller(true)`.
    - `SellerApplicationDTO reject(Long adminId, Long id, String reason)` — 400 nếu `reason` null/blank hoặc > 500 sau trim; 404/409 như trên; đặt `REJECTED` + `reviewNote`.
  - Tất cả method ghi là `@Transactional`; đọc là `@Transactional(readOnly = true)`.

- [ ] **Step 1: Viết test thất bại** `SellerApplicationServiceTests` (Mockito, không Spring) gồm:
  - `submitCreatesPendingApplicationWithTrimmedFields` — form có khoảng trắng hai đầu → entity lưu đã trim, `status == PENDING`, `userId` đúng.
  - `submitLocksTheUserRowBeforeCheckingPending` — `InOrder`: `users.lockById(7L)` trước `applications.existsByUserIdAndStatus(7L, PENDING)`; khi `exists` trả true → 409.
  - `submitRejectsSellersLockedAndDeletedUsers` — `isSeller=true` → 409; `LOCKED` → 403; `lockById` rỗng (đã xóa) → 401.
  - `submitValidatesDates` — tuổi 17 (sinh `now − 17 năm`) → 400 chứa "18 tuổi"; ngày cấp ngày mai → 400; ngày cấp trước ngày sinh → 400; ngày sinh 1899-12-31 → 400.
  - `approveTurnsOnSellerAndRecordsReviewer` — sau `approve(1L, 5L)`: `status == APPROVED`, `reviewedBy == 1L`, `reviewedAt != null`, `user.getIsSeller() == true`.
  - `approveRejectsLockedOrDeletedUser` — user `LOCKED` → 409 và `isSeller` vẫn false; `lockById` user rỗng → 409.
  - `approveOrRejectNonPendingConflicts` — hồ sơ `APPROVED` → `approve` và `reject` đều 409.
  - `rejectRequiresReasonAndStoresIt` — `"   "` → 400; 501 ký tự → 400; `"  Ảnh mờ  "` → `REJECTED`, `reviewNote == "Ảnh mờ"`.
  - `resubmitAfterRejectionCreatesNewRow` — `exists(PENDING)` false, hồ sơ trước `REJECTED` → `save` được gọi với entity mới (`id == null`).
  - `missingApplicationIs404` — `get`, `approve`, `reject` với id không tồn tại → 404.

- [ ] **Step 2: Chạy test, xác nhận thất bại vì chưa có lớp**

Run: `.\gradlew.bat test --tests '*SellerApplicationServiceTests' --console=plain`
Expected: lỗi biên dịch `SellerApplicationService` / `SellerApplicationForm` không tồn tại.

- [ ] **Step 3: Tạo `SellerApplicationForm`, `SellerApplicationDTO`, `SellerApplicationService`** theo Interfaces. Xóa `SellerUpgradeService.java`; sửa `@Import` của `SellerAccessTests` như mục Files.

- [ ] **Step 4: Chạy test**

Run: `.\gradlew.bat test --tests '*SellerApplicationServiceTests' --console=plain`
Expected: 10 test PASS.
Run: `.\gradlew.bat test --console=plain`
Expected: không có test hỏng mới so với mốc.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/example/comicworm/service/account/ src/main/java/com/example/comicworm/dto/ src/test/java/com/example/comicworm/SellerApplicationServiceTests.java src/test/java/com/example/comicworm/SellerAccessTests.java
git commit -m "feat(seller): add seller application service with submit/approve/reject rules"
```

---

### Task 3: Trang người dùng `/user/seller-upgrade`

**Files:**
- Modify: `src/main/java/com/example/comicworm/controller/SellerAccountController.java`
- Modify: `src/main/resources/templates/view/user/html/seller-upgrade.html`
- Create: `src/main/resources/static/user/images/cccd-sample-front.svg`, `cccd-sample-back.svg`
- Modify: `src/test/java/com/example/comicworm/SellerAccessTests.java` (viết lại `upgradeEndpointIsForbiddenForBuyers`, `upgradeRequiresLoginAndDisallowsNonSellers`; sửa `headAndAdminCannotBypassSellerUpgrade` nếu cần)

**Interfaces:**
- Consumes: Task 2 `SellerApplicationService.submit/latestFor`, `SellerApplicationForm.sample()`.
- Produces: `GET /user/seller-upgrade` và `POST /user/seller-upgrade` (form fields: `idNumber`, `idFullName`, `idDateOfBirth`, `idIssueDate`, `idIssuePlace`; ngày dạng `yyyy-MM-dd`). Model attributes cho template: `fullName`, `application` (`SellerApplicationDTO` hoặc null), `form` (`SellerApplicationForm`), `csrfExpired`.

Hành vi controller:
- Chưa đăng nhập: giữ như hiện tại (redirect login).
- `isSeller()` → `redirect:/seller/html/index.html` cho cả GET và POST.
- GET: `latestFor(userId)`; `PENDING` → hiện trạng thái chờ (chỉ đọc); `REJECTED` → hiện lý do + form điền sẵn từ hồ sơ trước; không có → form `SellerApplicationForm.sample()`.
- POST: `@Valid @ModelAttribute("form") SellerApplicationForm`, `BindingResult`; có lỗi (kể cả lỗi kiểu ngày) → render lại `view/user/html/seller-upgrade` với lỗi; `ResponseStatusException` 400 từ service → `bindingResult.reject(...)` hiển thị lỗi chung; 409 → redirect GET (đã có hồ sơ chờ); thành công → `redirect:/user/seller-upgrade`.

- [ ] **Step 1: Viết lại test trong `SellerAccessTests`** (thêm `@MockitoBean SellerApplicationRepository applications` nếu Task 2 chưa thêm):
  - `buyerSeesPrefilledFormWhenNoApplication` — GET với người mua, `latestFor` rỗng → 200, `model().attribute("form", SellerApplicationForm.sample())`, nội dung chứa `001099012345` và `cccd-sample-front.svg`.
  - `buyerSubmitsApplicationAndStaysBuyer` — POST đủ trường mẫu + `csrf()` → 302 `redirectedUrl("/user/seller-upgrade")`; sau đó GET `/seller/html/index.html` với cùng người mua → 403.
  - `pendingApplicationIsShownReadOnly` — `latestFor` trả `PENDING` → 200, nội dung chứa "đang chờ duyệt", không có nút "Gửi hồ sơ".
  - `rejectedApplicationShowsReasonAndForm` — `REJECTED` với `reviewNote` "Ảnh mờ" → nội dung chứa "Ảnh mờ" và nút "Gửi hồ sơ".
  - `malformedDateShowsFieldErrorInsteadOf500` — POST `idDateOfBirth=abc` → 200, `model().attributeHasFieldErrors("form", "idDateOfBirth")`.
  - `postWithoutCsrfIsRejected` — POST không `csrf()` → 403 (thiếu CSRF đi vào `accessDeniedHandler` của `SecurityConfig`), và `service.submit` không được gọi.
  - `sellerIsRedirectedToSellerHome` — người bán GET → 302 `/seller/html/index.html`.
  - Mock `SellerApplicationService` qua repository giả hoặc `@MockitoBean SellerApplicationService` — chọn `@MockitoBean SellerApplicationService` và bỏ nó khỏi `@Import`.

- [ ] **Step 2: Chạy, xác nhận thất bại**

Run: `.\gradlew.bat test --tests '*SellerAccessTests' --console=plain`
Expected: các test mới FAIL (controller vẫn trả 403).

- [ ] **Step 3: Sửa controller và template.** Tiêu đề trang và `<h1>`: "Đăng ký Người bán"; nút gửi: "Gửi hồ sơ". Template giữ khung `auth-card` + `auth-shared.css`; thêm hai `<img>` ảnh mẫu (`alt="Ảnh minh họa CCCD mẫu mặt trước/sau"`), các `<input>` có `required`, `pattern="\d{12}"` cho CCCD, `type="date"` cho ngày, `th:errors` dưới từng ô, và dòng chú thích "Thông tin CCCD hiện là dữ liệu mẫu để demo." Ảnh SVG tự vẽ khung thẻ, chữ "MẪU" lớn, không có dữ liệu người thật.

- [ ] **Step 4: Chạy test**

Run: `.\gradlew.bat test --tests '*SellerAccessTests' --console=plain`
Expected: toàn bộ `SellerAccessTests` PASS (kể cả hai test trước đây hỏng).
Run: `.\gradlew.bat test --console=plain`
Expected: tổng số hỏng giảm còn 11.

- [ ] **Step 5: Kiểm tra tay** — mở `http://localhost:8080/user/seller-upgrade` bằng một tài khoản người mua: thấy form điền sẵn + 2 ảnh; gửi → thấy "đang chờ duyệt".

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/example/comicworm/controller/SellerAccountController.java src/main/resources/templates/view/user/html/seller-upgrade.html src/main/resources/static/user/images/ src/test/java/com/example/comicworm/SellerAccessTests.java
git commit -m "feat(seller): seller application form and status page"
```

---

### Task 4: API admin `/api/admin/seller-applications`

**Files:**
- Create: `src/main/java/com/example/comicworm/controller/admin/AdminSellerApplicationController.java`
- Create: `src/main/java/com/example/comicworm/dto/request/RejectSellerApplicationRequest.java`
- Test: `src/test/java/com/example/comicworm/AdminSellerApplicationControllerSecurityTests.java`

**Interfaces:**
- Consumes: Task 2 `SellerApplicationService.list/get/approve/reject`, `SellerApplicationDTO`.
- Produces (JSON, lỗi dạng `{"message": "..."}` như `AdminModerationController`):
  - `GET /api/admin/seller-applications?status=PENDING` → `List<SellerApplicationDTO>`; status sai → 400.
  - `GET /api/admin/seller-applications/{id}` → `SellerApplicationDTO`
  - `POST /api/admin/seller-applications/{id}/approve` → `SellerApplicationDTO`
  - `POST /api/admin/seller-applications/{id}/reject` body `RejectSellerApplicationRequest(@NotBlank @Size(max=500) String reason)` → `SellerApplicationDTO`
  - `GET /api/admin/seller-applications/csrf` → `{"headerName","token"}`
  - Lớp có `@PreAuthorize("hasRole('ADMIN')")`, sao chép `@ExceptionHandler` của `AdminModerationController`.

- [ ] **Step 1: Viết test thất bại** theo khuôn `ProductModerationControllerSecurityTests` (`@WebMvcTest(AdminSellerApplicationController.class)`, `@Import({SecurityConfig.class, JwtAuthenticationFilter.class})`, `@MockitoBean SellerApplicationService`):
  - `anonymousGets401AndBuyerGets403` — GET danh sách: khách → 401; người dùng `ROLE_USER` → 403.
  - `adminListsPendingByDefault` — admin GET không tham số → 200, `service.list(PENDING)` được gọi.
  - `invalidStatusReturns400` — `?status=abc` → 400.
  - `approveRequiresCsrf` — admin POST approve không `csrf()` → 403; có `csrf()` → 200 và `service.approve(999L, 5L)`.
  - `rejectWithBlankReasonReturns400` — body `{"reason":"   "}` → 400, JSON có `message`.
  - `conflictFromServiceIsReturnedAs409` — `service.approve` ném 409 → 409, JSON `message`.

- [ ] **Step 2: Chạy, xác nhận thất bại**

Run: `.\gradlew.bat test --tests '*AdminSellerApplicationControllerSecurityTests' --console=plain`
Expected: lỗi biên dịch (controller chưa có).

- [ ] **Step 3: Tạo controller và request DTO** theo Interfaces.

- [ ] **Step 4: Chạy test**

Run: `.\gradlew.bat test --tests '*AdminSellerApplicationControllerSecurityTests' --console=plain`
Expected: 6 PASS. Toàn bộ suite: vẫn 11 hỏng.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/example/comicworm/controller/admin/AdminSellerApplicationController.java src/main/java/com/example/comicworm/dto/request/RejectSellerApplicationRequest.java src/test/java/com/example/comicworm/AdminSellerApplicationControllerSecurityTests.java
git commit -m "feat(admin): seller application review API"
```

---

### Task 5: Đổi nhãn "Đăng ký Người bán" và nối tab admin có sẵn

**Files:**
- Modify: `src/main/resources/static/admin/js/accounts.js` (khối "DUYỆT ĐĂNG KÝ NGƯỜI BÁN (MOCK UI)" quanh dòng 40–200: thay mảng `sellerApplications` cứng bằng dữ liệu từ API)
- Modify: `src/main/resources/templates/view/admin/html/accounts.html` (tab `data-view="sellerApps"`, bảng `#sellerAppTable`, modal `#sellerAppDetailModal`: bỏ các cột/ô không có trong spec như tên shop, ngành hàng, địa chỉ; thêm họ tên CCCD, ngày sinh, ngày cấp, nơi cấp, hai ảnh mẫu)
- Modify (đổi nhãn "Nâng cấp lên Người bán" → "Đăng ký Người bán", "nâng cấp lên Người bán" → "đăng ký Người bán"): `static/shared/sidebar/sidebar.js:125`, `static/seller/js/revenue.js:60`, `static/shared/js/analytics-page.js:133`, `static/seller/js/products-api.js:27`, `static/shared/js/analytics-api.js:24`, `static/user/js/profile.js:51,61`, `templates/view/user/html/profile.html:98,110`. Tiêu đề trang `seller-upgrade.html` đã đổi ở Task 3 ("Đăng ký Người bán").

**Interfaces:**
- Consumes: API Task 4.

Hành vi tab "Quản lý đăng ký người bán":
- Bộ lọc Chờ duyệt / Đã duyệt / Đã từ chối gọi `GET /api/admin/seller-applications?status=...`; số đếm chờ duyệt (`#sellerAppPendingCount`, `#sellerAppPendingTabCount`) lấy từ danh sách `PENDING`.
- Bảng: người dùng, email, số CCCD, ngày gửi, trạng thái. Bấm dòng → modal chi tiết (thông tin CCCD + hai ảnh `/user/images/cccd-sample-*.svg` + lý do nếu bị từ chối).
- Duyệt/Từ chối (lý do bắt buộc, `maxlength="500"`) gọi API có CSRF: lấy token từ `/api/admin/seller-applications/csrf`, gửi qua header `headerName`. Lỗi `message` hiện bằng `showToast(..., 'danger')`; 409 → toast rồi tải lại danh sách.
- Chèn chuỗi từ API bằng `escapeHtml` có sẵn trong `accounts.js`.
- Ngoài phạm vi: nút "Cấp quyền người bán" của trang này cũng thiếu CSRF (đã xác nhận 403) — để lại, ghi nhận ở báo cáo cuối.

- [ ] **Step 1: Đổi nhãn ở các file trên.**
- [ ] **Step 2: Nối tab admin với API.**
- [ ] **Step 3: Kiểm tra tay trên app local** (khởi động lại `bootRun` sau khi đã áp migration ở Task 1):
  1. Người mua A thấy mục "Đăng ký Người bán" trên sidebar → bấm → form điền sẵn → gửi → "đang chờ duyệt".
  2. Admin → Quản lý tài khoản → tab "Quản lý đăng ký người bán" → thấy hồ sơ của A, số đếm chờ duyệt đúng.
  3. Từ chối với lý do trống → bị chặn; với "Ảnh mờ" → hồ sơ sang "Đã từ chối".
  4. A mở lại trang → thấy "Ảnh mờ" → gửi lại.
  5. Admin duyệt → A tải lại `/seller/html/index.html` → vào được, không cần đăng nhập lại.
  6. Hai tab admin cùng mở một hồ sơ chờ: tab 1 duyệt, tab 2 từ chối → toast xung đột và danh sách tải lại.
- [ ] **Step 4: Chạy toàn bộ test** — `.\gradlew.bat test --console=plain`; Expected: 11 hỏng (đều thuộc mốc).
