package com.example.comicworm.service.admin;

import com.example.comicworm.dto.response.AdminProductRecord;
import com.example.comicworm.model.enums.ModerationStatus;

import java.util.Map;

public interface IProductModerationService {

    Map<String, Object> list(ModerationStatus status, String keyword, int page, int size);

    AdminProductRecord get(Long id);

    AdminProductRecord approve(Long id, Long adminId);

    AdminProductRecord reject(Long id, Long adminId, String reason);

    Map<String, Long> countStats();
}
