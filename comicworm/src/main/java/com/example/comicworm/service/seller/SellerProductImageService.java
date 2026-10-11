package com.example.comicworm.service.seller;

import com.example.comicworm.dto.response.SellerProductRecord;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.model.enums.ProductImageType;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.ProductImageRepository;
import com.example.comicworm.repository.ProductImageFeatureRepository;
import com.example.comicworm.service.upload.UploadService;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("!preview")
@Transactional(readOnly = true)
public class SellerProductImageService {
    public static final int MAX_IMAGES = 8;
    private final ProductRepository products;
    private final ProductImageRepository images;
    private final ProductImageFeatureRepository features;
    private final UploadService uploads;

    public SellerProductImageService(ProductRepository products, ProductImageRepository images,
            ProductImageFeatureRepository features, UploadService uploads) {
        this.products = products; this.images = images; this.features = features; this.uploads = uploads;
    }

    public Map<String, Object> list(Long sellerId, Long productId) {
        var product = products.findByIdAndSellerIdAndDeletedAtIsNull(productId, sellerId).orElseThrow(this::notFound);
        return result(product);
    }

    /** Save cover, append details, and remove selected details in the CRUD transaction. */
    @Transactional
    public Map<String, Object> save(Long sellerId, Long productId, MultipartFile cover,
            List<MultipartFile> details, List<Long> removeIds) {
        var product = owned(sellerId, productId);
        var existing = images.findByProductIdOrderByDisplayOrderAscIdAsc(productId);
        var oldCover = existing.stream().filter(image -> image.getImageType() == ProductImageType.COVER).findFirst();
        if (cover == null && oldCover.isEmpty()) throw badRequest("Vui lòng chọn ảnh bìa sản phẩm.");
        var removed = new HashSet<>(removeIds == null ? List.<Long>of() : removeIds);
        if (removed.stream().anyMatch(id -> id == null || id <= 0)
                || !existing.stream().map(ProductImage::getId).toList().containsAll(removed)) throw notFound();
        if (oldCover.isPresent() && removed.contains(oldCover.get().getId()))
            throw badRequest("Vui lòng chọn ảnh bìa mới để thay thế ảnh bìa hiện tại.");
        if (cover != null) oldCover.ifPresent(image -> removed.add(image.getId()));
        var retained = existing.stream().filter(image -> !removed.contains(image.getId())).toList();
        var files = new ArrayList<MultipartFile>();
        if (cover != null) files.add(cover);
        if (details != null) files.addAll(details);
        if (retained.size() + files.size() > MAX_IMAGES)
            throw badRequest("Mỗi sản phẩm có 1 ảnh bìa và tối đa 7 ảnh chi tiết.");
        var uploaded = files.isEmpty() ? List.<UploadService.UploadedImage>of()
                : uploads.uploadMultiple(files, "comicworm/products/" + sellerId + "/" + productId);
        rollbackCleanup(uploaded);
        deleteRows(new ArrayList<>(removed));
        int order = retained.stream().mapToInt(ProductImage::getDisplayOrder).max().orElse(-1) + 1;
        int index = 0;
        if (cover != null) {
            int coverOrder = 0;
            var occupied = retained.stream().map(ProductImage::getDisplayOrder).toList();
            while (occupied.contains(coverOrder)) coverOrder++;
            persist(productId, uploaded.get(index++), ProductImageType.COVER, coverOrder);
            order = Math.max(order, coverOrder + 1);
        }
        for (; index < uploaded.size(); index++) persist(productId, uploaded.get(index), ProductImageType.DETAIL, order++);
        images.flush();
        syncCoverAndModeration(product);
        return result(product);
    }

    /** Existing upload endpoint: first image becomes the cover if the product has none. */
    @Transactional
    public Map<String, Object> upload(Long sellerId, Long productId, List<MultipartFile> files) {
        var product = owned(sellerId, productId);
        if (files == null || files.isEmpty()) throw badRequest("Vui lòng chọn ít nhất một ảnh.");
        boolean hasCover = images.findByProductIdOrderByDisplayOrderAscIdAsc(product.getId()).stream()
                .anyMatch(image -> image.getImageType() == ProductImageType.COVER);
        return save(sellerId, productId, hasCover ? null : files.getFirst(),
                hasCover ? files : files.subList(1, files.size()), List.of());
    }

    @Transactional
    public Map<String, Object> remove(Long sellerId, Long productId, Long imageId) {
        var product = owned(sellerId, productId);
        var image = images.findByIdAndProductId(imageId, productId).orElseThrow(this::notFound);
        deleteRows(List.of(imageId));
        var remaining = images.findByProductIdOrderByDisplayOrderAscIdAsc(productId);
        if (image.getImageType() == ProductImageType.COVER && !remaining.isEmpty()) {
            remaining.getFirst().setImageType(ProductImageType.COVER); images.saveAndFlush(remaining.getFirst());
        }
        syncCoverAndModeration(product);
        return result(product);
    }

    private Product owned(Long sellerId, Long productId) {
        return products.lockOwnedProduct(productId, sellerId).orElseThrow(this::notFound);
    }

    private void persist(Long productId, UploadService.UploadedImage uploaded, ProductImageType type, int order) {
        var entity = new ProductImage(); entity.setProductId(productId); entity.setImageUrl(uploaded.url());
        entity.setImageType(type); entity.setDisplayOrder(order); images.save(entity);
    }

    private void rollbackCleanup(List<UploadService.UploadedImage> uploaded) {
        if (uploaded.isEmpty()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) uploads.cleanup(uploaded);
            }
        });
    }

    private void deleteRows(List<Long> ids) {
        if (ids.isEmpty()) return;
        features.deleteAllById(ids); features.flush(); images.deleteAllById(ids); images.flush();
        // Keep Cloudinary URLs accessible for historical order snapshots.
    }

    private Map<String, Object> result(Product product) {
        var record = SellerProductRecord.from(product, images.findByProductIdOrderByDisplayOrderAscIdAsc(product.getId()));
        return Map.of("Result", "OK", "Records", record.images(), "CoverImageUrl", product.getCoverImageUrl() == null ? "" : product.getCoverImageUrl(),
                "MaxImages", MAX_IMAGES, "MaxFileBytes", UploadService.MAX_FILE_BYTES, "UploadConfigured", uploads.isConfigured());
    }

    private void syncCoverAndModeration(Product product) {
        product.setCoverImageUrl(images.findByProductIdOrderByDisplayOrderAscIdAsc(product.getId()).stream()
                .filter(image -> image.getImageType() == ProductImageType.COVER).map(ProductImage::getImageUrl).findFirst().orElse(null));
        product.setModerationStatus(ModerationStatus.PENDING); product.setModeratedBy(null);
        product.setModeratedAt(null); product.setModerationReason(null);
        product.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC)); products.saveAndFlush(product);
    }

    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm hoặc ảnh trong gian hàng của bạn.");
    }
}
