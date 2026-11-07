package com.example.comicworm.service.admin;

import com.example.comicworm.dto.response.AdminProductRecord;
import com.example.comicworm.model.enums.AiVerdict;
import com.example.comicworm.model.enums.ModerationStatus;

import java.util.Map;

public interface IProductModerationService {

    /** @param verdict lọc theo kết quả phân loại tự động; null = không lọc */
    Map<String, Object> list(ModerationStatus status, AiVerdict verdict, String keyword, int page, int size);

    AdminProductRecord get(Long id);

    /** Chỉ duyệt được sản phẩm chờ duyệt đã được phân loại VALID. */
    AdminProductRecord approve(Long id, Long adminId);

    AdminProductRecord reject(Long id, Long adminId, String reason);

    /** Admin ghi đè kết quả phân loại thành VALID để có thể duyệt. */
    AdminProductRecord markValid(Long id, Long adminId);

    Map<String, Long> countStats();
}
