package com.example.comicworm.service.upload;

import com.cloudinary.Cloudinary;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Spring adaptation of the supplied UploadService: upload bytes and use secure_url. */
@Service
public class UploadService {
    public static final long MAX_FILE_BYTES = 5 * 1024 * 1024;
    private static final Set<String> TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Logger log = LoggerFactory.getLogger(UploadService.class);
    private final Cloudinary cloudinary;

    public UploadService(Cloudinary cloudinary) { this.cloudinary = cloudinary; }

    public record UploadedImage(String url, String publicId) {}

    public boolean isConfigured() {
        return cloudinary.config.cloudName != null && !cloudinary.config.cloudName.isBlank()
                && cloudinary.config.apiKey != null && !cloudinary.config.apiKey.isBlank()
                && cloudinary.config.apiSecret != null && !cloudinary.config.apiSecret.isBlank();
    }

    public void validate(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) throw badRequest("Vui lòng chọn ít nhất một ảnh.");
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) throw badRequest("Tệp ảnh không được rỗng.");
            if (file.getSize() > MAX_FILE_BYTES) throw badRequest("Mỗi ảnh tối đa 5 MB.");
            if (file.getContentType() == null || !TYPES.contains(file.getContentType())) throw badRequest("Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.");
            try (var stream = file.getInputStream()) {
                if (!matchesType(stream.readNBytes(12), file.getContentType()))
                    throw badRequest("Nội dung tệp không đúng định dạng ảnh.");
            } catch (IOException error) { throw badRequest("Không đọc được tệp ảnh. Vui lòng chọn lại."); }
        }
    }

    public UploadedImage upload(MultipartFile file, String folder) {
        return uploadMultiple(List.of(file), folder).getFirst();
    }

    public List<UploadedImage> uploadMultiple(List<MultipartFile> files, String folder) {
        validate(files);
        if (!isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Chưa cấu hình Cloudinary trên máy chủ. Vui lòng bổ sung thông tin kết nối.");
        var uploaded = new ArrayList<UploadedImage>();
        try {
            for (MultipartFile file : files) {
                Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(), Map.of(
                        "folder", folder, "resource_type", "image", "allowed_formats", List.of("jpg", "png", "webp", "gif"),
                        "use_filename", false, "unique_filename", true, "overwrite", false, "timeout", 60000));
                String publicId = result.get("public_id") instanceof String id ? id : null;
                String url = result.get("secure_url") instanceof String value ? value : null;
                if (publicId == null || publicId.isBlank()) throw new IOException("Missing public ID");
                // Register immediately so even an invalid response can be cleaned up.
                uploaded.add(new UploadedImage(url, publicId));
                if (url == null || !"https".equals(URI.create(url).getScheme()) || URI.create(url).getHost() == null)
                    throw new IOException("Missing HTTPS URL");
            }
            return List.copyOf(uploaded);
        } catch (Exception error) {
            cleanup(uploaded);
            // SDK errors can contain credentials. Do not expose those messages or stack traces.
            log.warn("Cloudinary image upload failed ({})", error.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Không tải được ảnh lên Cloudinary. Vui lòng kiểm tra kết nối và thử lại.");
        }
    }

    /** Remove only newly uploaded assets when their database transaction fails. */
    public void cleanup(List<UploadedImage> uploaded) {
        for (UploadedImage image : uploaded) {
            try { cloudinary.uploader().destroy(image.publicId(), Map.of("resource_type", "image", "invalidate", true)); }
            catch (Exception error) { log.warn("Cloudinary could not clean up an unsaved image ({})", error.getClass().getSimpleName()); }
        }
    }

    private boolean matchesType(byte[] bytes, String type) {
        if (bytes.length < 12) return false;
        return switch (type) {
            case "image/jpeg" -> (bytes[0] & 255) == 255 && (bytes[1] & 255) == 216 && (bytes[2] & 255) == 255;
            case "image/png" -> java.util.Arrays.equals(java.util.Arrays.copyOf(bytes, 8),
                    new byte[] {(byte)137, 80, 78, 71, 13, 10, 26, 10});
            case "image/gif" -> new String(bytes, 0, 6, StandardCharsets.US_ASCII).matches("GIF8[79]a");
            case "image/webp" -> new String(bytes, 0, 4, StandardCharsets.US_ASCII).equals("RIFF")
                    && new String(bytes, 8, 4, StandardCharsets.US_ASCII).equals("WEBP");
            default -> false;
        };
    }

    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
