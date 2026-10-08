package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.SellerProductRequest;
import com.example.comicworm.service.seller.SellerProductService;
import com.example.comicworm.service.seller.SellerProductImageService;
import java.util.List;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.dao.DataAccessException;

@RestController
@Profile("!preview")
@RequestMapping("/api/seller/products")
public class SellerProductController {
    private final SellerProductService service;
    private final SellerProductImageService images;
    public SellerProductController(SellerProductService service, SellerProductImageService images) {
        this.service = service; this.images = images;
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(defaultValue = "0") int jtStartIndex, @RequestParam(defaultValue = "10") int jtPageSize,
            @RequestParam(defaultValue = "id DESC") String jtSorting, @RequestParam(defaultValue = "") String search,
            @RequestParam(required = false) Integer categoryId, @RequestParam(defaultValue = "all") String stock) {
        return service.list(seller(user), jtStartIndex, jtPageSize, jtSorting, search, categoryId, stock);
    }

    @GetMapping("/options")
    public Map<String, Object> options(@AuthenticationPrincipal CustomUserDetails user) { seller(user); return service.options(); }

    @GetMapping("/csrf")
    public Map<String, Object> csrf(@AuthenticationPrincipal CustomUserDetails user, CsrfToken token) {
        seller(user);
        return Map.of("Result", "OK", "headerName", token.getHeaderName(), "token", token.getToken());
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id) {
        return Map.of("Result", "OK", "Record", service.get(seller(user), id));
    }

    @PostMapping(consumes = "application/json")
    public Map<String, Object> create(@AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody SellerProductRequest request) {
        return Map.of("Result", "OK", "Record", service.create(seller(user), request));
    }

    @PutMapping(value = "/{id}", consumes = "application/json")
    public Map<String, Object> update(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id,
            @Valid @RequestBody SellerProductRequest request) {
        return Map.of("Result", "OK", "Record", service.update(seller(user), id, request));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id) {
        service.delete(seller(user), id); return Map.of("Result", "OK");
    }

    @PostMapping(consumes = "multipart/form-data")
    public Map<String, Object> createWithImages(@AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestPart("product") SellerProductRequest request,
            @RequestPart("coverImage") MultipartFile cover,
            @RequestPart(value = "detailImages", required = false) List<MultipartFile> details) {
        return Map.of("Result", "OK", "Record", service.createWithImages(seller(user), request, cover, details));
    }

    @PutMapping(value = "/{id}", consumes = "multipart/form-data")
    public Map<String, Object> updateWithImages(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id,
            @Valid @RequestPart("product") SellerProductRequest request,
            @RequestPart(value = "coverImage", required = false) MultipartFile cover,
            @RequestPart(value = "detailImages", required = false) List<MultipartFile> details,
            @RequestPart(value = "removeImageIds", required = false) List<Long> removeIds) {
        return Map.of("Result", "OK", "Record", service.updateWithImages(seller(user), id, request, cover, details, removeIds));
    }

    @GetMapping("/{id}/images")
    public Map<String, Object> images(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id) {
        return images.list(seller(user), id);
    }

    @PostMapping(value = "/{id}/images", consumes = "multipart/form-data")
    public Map<String, Object> uploadImages(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id,
            @RequestPart("files") List<MultipartFile> files) {
        return images.upload(seller(user), id, files);
    }

    @DeleteMapping("/{id}/images/{imageId}")
    public Map<String, Object> removeImage(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id,
            @PathVariable Long imageId) {
        return images.remove(seller(user), id, imageId);
    }

    private Long seller(CustomUserDetails user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        if (!user.isSeller()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn cần nâng cấp lên Người bán.");
        return user.getId();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> serviceError(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("Result", "ERROR", "Message",
                error.getReason() == null ? "Không thực hiện được thao tác." : error.getReason()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> validationError(MethodArgumentNotValidException error) {
        String message = error.getBindingResult().getFieldErrors().stream().map(field -> field.getDefaultMessage())
                .distinct().reduce((left, right) -> left + " " + right).orElse("Dữ liệu sản phẩm không hợp lệ.");
        return ResponseEntity.badRequest().body(Map.of("Result", "ERROR", "Message", message));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, String>> malformedRequest(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("Result", "ERROR", "Message", "Dữ liệu sản phẩm hoặc bộ lọc không đúng định dạng."));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<Map<String, String>> missingFiles(MissingServletRequestPartException error) {
        String message = error.getRequestPartName().equals("coverImage") ? "Vui lòng chọn ảnh bìa sản phẩm."
                : error.getRequestPartName().equals("product") ? "Thiếu thông tin sản phẩm." : "Vui lòng chọn ảnh sản phẩm.";
        return ResponseEntity.badRequest().body(Map.of("Result", "ERROR", "Message", message));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> oversizedFiles(Exception error) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("Result", "ERROR", "Message", "Mỗi ảnh tối đa 5 MB, tối đa 8 ảnh mỗi lần tải."));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, String>> databaseError(Exception error) {
        return ResponseEntity.internalServerError().body(Map.of("Result", "ERROR", "Message", "Chưa lưu được dữ liệu sản phẩm. Vui lòng thử lại."));
    }
}
