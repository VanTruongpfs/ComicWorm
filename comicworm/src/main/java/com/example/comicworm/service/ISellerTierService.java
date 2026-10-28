package com.example.comicworm.service;

import com.example.comicworm.dto.request.CreateUpgradeRequestDTO;
import com.example.comicworm.dto.response.SellerTierInfoDTO;
import com.example.comicworm.dto.response.SellerUpgradeRequestDTO;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

public interface ISellerTierService {

    /** Lấy thông tin cấp bậc hiện tại, đặc quyền và trạng thái đơn xin nâng cấp của người dùng */
    SellerTierInfoDTO getTierInfo(Long userId);

    /** Tạo đơn yêu cầu nâng cấp sàn (User -> Cấp 1..5) kèm bằng chứng thanh toán */
    SellerUpgradeRequestDTO requestUpgrade(Long userId, CreateUpgradeRequestDTO request);

    /** Tải lên ảnh chụp biên lai chuyển khoản / hóa đơn */
    String uploadProof(MultipartFile file);

    /** Admin: Lấy danh sách các yêu cầu nâng cấp */
    Page<SellerUpgradeRequestDTO> getAdminRequests(String status, int page, int size);

    /** Admin: Xem chi tiết 1 yêu cầu */
    SellerUpgradeRequestDTO getAdminRequestDetail(Long requestId);

    /** Admin: Duyệt yêu cầu nâng cấp */
    SellerUpgradeRequestDTO approveRequest(Long adminId, Long requestId);

    /** Admin: Từ chối yêu cầu nâng cấp */
    SellerUpgradeRequestDTO rejectRequest(Long adminId, Long requestId, String reason);
}

