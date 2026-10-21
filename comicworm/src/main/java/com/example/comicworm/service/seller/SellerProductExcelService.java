package com.example.comicworm.service.seller;

import com.example.comicworm.dto.request.SellerProductRequest;
import com.example.comicworm.dto.response.SellerProductImportResult;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.enums.ProductImageType;
import com.example.comicworm.repository.ProductImageRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@Profile("!preview")
public class SellerProductExcelService {

    public static final String DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80";

    private final SellerProductService sellerProductService;
    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;

    public SellerProductExcelService(SellerProductService sellerProductService,
                                     ProductRepository productRepository,
                                     ProductImageRepository productImageRepository) {
        this.sellerProductService = sellerProductService;
        this.productRepository = productRepository;
        this.productImageRepository = productImageRepository;
    }

    /**
     * Tạo file Excel mẫu chuẩn (.xlsx) để người bán tải về và điền sản phẩm hàng loạt
     */
    public byte[] generateTemplate() {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Sheet 1: Danh Sách Sản Phẩm
            XSSFSheet sheet = workbook.createSheet("Danh Sách Sản Phẩm");
            sheet.setDisplayGridlines(true);

            // Font & Styles
            XSSFFont headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);
            headerFont.setFontName("Segoe UI");

            XSSFCellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 249, (byte) 115, (byte) 22}, null)); // ComicHub Orange #F97316
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            XSSFFont dataFont = workbook.createFont();
            dataFont.setFontHeightInPoints((short) 10);
            dataFont.setFontName("Segoe UI");

            XSSFCellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setFont(dataFont);
            dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);

            XSSFCellStyle numberStyle = workbook.createCellStyle();
            numberStyle.cloneStyleFrom(dataStyle);
            numberStyle.setAlignment(HorizontalAlignment.RIGHT);
            DataFormat format = workbook.createDataFormat();
            numberStyle.setDataFormat(format.getFormat("#,##0"));

            XSSFCellStyle centerStyle = workbook.createCellStyle();
            centerStyle.cloneStyleFrom(dataStyle);
            centerStyle.setAlignment(HorizontalAlignment.CENTER);

            // Tiêu đề các cột
            String[] headers = {
                    "Tên truyện / Sản phẩm (*)",
                    "Thể loại (*)",
                    "Tác giả",
                    "Nhà xuất bản (*)",
                    "Tập / Số tập",
                    "Phiên bản",
                    "Năm XB",
                    "Độ mới (%) (*)",
                    "Giá bán (VNĐ) (*)",
                    "Tồn kho (*)",
                    "Hình thức (*)",
                    "Nhu cầu đổi (nếu có)",
                    "Mô tả chi tiết (*)",
                    "Link ảnh bìa (tùy chọn)"
            };

            Row headerRow = sheet.createRow(0);
            headerRow.setHeightInPoints(28);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Dòng dữ liệu mẫu 1
            Row sampleRow1 = sheet.createRow(1);
            sampleRow1.setHeightInPoints(22);
            createCell(sampleRow1, 0, "Thám Tử Lừng Danh Conan - Tập 100", dataStyle);
            createCell(sampleRow1, 1, "Manga Shonen", dataStyle);
            createCell(sampleRow1, 2, "Gosho Aoyama", dataStyle);
            createCell(sampleRow1, 3, "NXB Kim Đồng", dataStyle);
            createCell(sampleRow1, 4, "Tập 100", dataStyle);
            createCell(sampleRow1, 5, "Bản đặc biệt kèm bookmark", dataStyle);
            createNumericCell(sampleRow1, 6, 2023, centerStyle);
            createNumericCell(sampleRow1, 7, 98, centerStyle);
            createNumericCell(sampleRow1, 8, 45000, numberStyle);
            createNumericCell(sampleRow1, 9, 5, centerStyle);
            createCell(sampleRow1, 10, "Bán", centerStyle);
            createCell(sampleRow1, 11, "", dataStyle);
            createCell(sampleRow1, 12, "Truyện sưu tầm mới 98%, có bọc bìa OPP bóng kính bảo quản, giấy trắng tinh không ố.", dataStyle);
            createCell(sampleRow1, 13, "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c", dataStyle);

            // Dòng dữ liệu mẫu 2
            Row sampleRow2 = sheet.createRow(2);
            sampleRow2.setHeightInPoints(22);
            createCell(sampleRow2, 0, "Chú Thuật Hồi Chiến - Jujutsu Kaisen Tập 0", dataStyle);
            createCell(sampleRow2, 1, "Manga", dataStyle);
            createCell(sampleRow2, 2, "Gege Akutami", dataStyle);
            createCell(sampleRow2, 3, "NXB Kim Đồng", dataStyle);
            createCell(sampleRow2, 4, "Tập 0", dataStyle);
            createCell(sampleRow2, 5, "Bìa rời", dataStyle);
            createNumericCell(sampleRow2, 6, 2022, centerStyle);
            createNumericCell(sampleRow2, 7, 95, centerStyle);
            createNumericCell(sampleRow2, 8, 35000, numberStyle);
            createNumericCell(sampleRow2, 9, 2, centerStyle);
            createCell(sampleRow2, 10, "Cả hai", centerStyle);
            createCell(sampleRow2, 11, "Muốn đổi lấy Chainsaw Man tập 1 hoặc Tokyo Revengers", dataStyle);
            createCell(sampleRow2, 12, "Truyện đọc lướt 1 lần, góc sách vuông vắn không gãy gáy.", dataStyle);
            createCell(sampleRow2, 13, "", dataStyle);

            // Auto fit column widths
            int[] colWidths = {32, 18, 20, 20, 16, 22, 12, 16, 18, 12, 14, 30, 40, 35};
            for (int i = 0; i < colWidths.length; i++) {
                sheet.setColumnWidth(i, colWidths[i] * 256);
            }

            // Sheet 2: Hướng Dẫn & Quy Định
            XSSFSheet guideSheet = workbook.createSheet("Hướng Dẫn Điền Dữ Liệu");
            guideSheet.setDisplayGridlines(true);

            XSSFCellStyle guideHeaderStyle = workbook.createCellStyle();
            guideHeaderStyle.setFont(headerFont);
            guideHeaderStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 71, (byte) 85, (byte) 105}, null)); // Slate #475569
            guideHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            guideHeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            guideHeaderStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            guideHeaderStyle.setBorderTop(BorderStyle.THIN);
            guideHeaderStyle.setBorderBottom(BorderStyle.THIN);
            guideHeaderStyle.setBorderLeft(BorderStyle.THIN);
            guideHeaderStyle.setBorderRight(BorderStyle.THIN);

            Row guideHeaderRow = guideSheet.createRow(0);
            guideHeaderRow.setHeightInPoints(26);
            createCell(guideHeaderRow, 0, "Tên cột", guideHeaderStyle);
            createCell(guideHeaderRow, 1, "Bắt buộc?", guideHeaderStyle);
            createCell(guideHeaderRow, 2, "Quy định & Giải thích", guideHeaderStyle);
            createCell(guideHeaderRow, 3, "Ví dụ", guideHeaderStyle);

            String[][] guideData = {
                    {"Tên truyện / Sản phẩm", "Bắt buộc (*)", "Tên sách hoặc bộ truyện cần bán (Tối đa 255 ký tự).", "Doraemon Tuyển Tập - Tập 1"},
                    {"Thể loại", "Bắt buộc (*)", "Tên thể loại. Nếu thể loại chưa có, hệ thống sẽ tự động thêm mới.", "Manga, Comic, Tiểu thuyết..."},
                    {"Tác giả", "Tùy chọn", "Tên tác giả sáng tác truyện.", "Fujiko F. Fujio"},
                    {"Nhà xuất bản", "Bắt buộc (*)", "Tên nhà xuất bản sách. Hệ thống tự động tạo nếu chưa có.", "NXB Kim Đồng, NXB Trẻ..."},
                    {"Tập / Số tập", "Tùy chọn", "Ghi chú tập truyện số mấy hoặc khoảng tập.", "Tập 1, Tập 1-5, Full bộ 12 tập"},
                    {"Phiên bản", "Tùy chọn", "Quy cách in ấn hoặc phiên bản sách.", "Bìa rời, Bìa cứng, Bản giới hạn"},
                    {"Năm XB", "Tùy chọn", "Năm xuất bản (từ 1000 đến 9999).", "2023"},
                    {"Độ mới (%)", "Bắt buộc (*)", "Tình trạng sách từ 0 đến 100%. (Ví dụ 95 nghĩa là 95% Like New).", "95"},
                    {"Giá bán (VNĐ)", "Bắt buộc (*)", "Giá bán sách bằng số nguyên, không âm (>= 0 VNĐ).", "45000"},
                    {"Tồn kho", "Bắt buộc (*)", "Số lượng sách thực tế có sẵn để bán (>= 0).", "10"},
                    {"Hình thức", "Bắt buộc (*)", "Điền 'Bán', 'Trao đổi' hoặc 'Cả hai'.", "Bán"},
                    {"Nhu cầu đổi", "Tùy chọn", "Ghi chú sách muốn đổi khi chọn hình thức Trao đổi hoặc Cả hai.", "Muốn đổi Conan tập 99"},
                    {"Mô tả chi tiết", "Bắt buộc (*)", "Mô tả chi tiết tình trạng sách, cam kết bảo quản cho người mua.", "Sách đẹp, không rách bìa, không ố giấy."},
                    {"Link ảnh bìa", "Tùy chọn", "Đường dẫn URL ảnh bìa (nếu có). Nếu để trống, hệ thống tự động gán ảnh bìa mặc định. Bạn có thể bấm nút 'Ảnh' trên web để tải ảnh thật lên Cloudinary.", "https://res.cloudinary.com/..."}
            };

            for (int r = 0; r < guideData.length; r++) {
                Row row = guideSheet.createRow(r + 1);
                row.setHeightInPoints(22);
                createCell(row, 0, guideData[r][0], dataStyle);
                createCell(row, 1, guideData[r][1], centerStyle);
                createCell(row, 2, guideData[r][2], dataStyle);
                createCell(row, 3, guideData[r][3], dataStyle);
            }

            guideSheet.setColumnWidth(0, 24 * 256);
            guideSheet.setColumnWidth(1, 14 * 256);
            guideSheet.setColumnWidth(2, 45 * 256);
            guideSheet.setColumnWidth(3, 30 * 256);

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể tạo file Excel mẫu: " + e.getMessage());
        }
    }

    /**
     * Đọc và nhập dữ liệu sản phẩm hàng loạt từ file Excel tải lên
     */
    public SellerProductImportResult importExcel(Long sellerId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn file Excel để nhập.");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.toLowerCase().endsWith(".xlsx") && !filename.toLowerCase().endsWith(".xls"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Định dạng file không hợp lệ. Vui lòng chọn file Excel (.xlsx hoặc .xls).");
        }

        List<String> errors = new ArrayList<>();
        int successCount = 0;
        int totalRows = 0;

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File Excel không có trang tính nào.");
            }

            int lastRowNum = sheet.getLastRowNum();
            DataFormatter formatter = new DataFormatter();

            for (int rowIndex = 1; rowIndex <= lastRowNum; rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || isRowEmpty(row, formatter)) {
                    continue;
                }

                totalRows++;
                int displayRowNumber = rowIndex + 1;

                try {
                    String title = getCellString(row.getCell(0), formatter);
                    String categoryName = getCellString(row.getCell(1), formatter);
                    String authorName = getCellString(row.getCell(2), formatter);
                    String publisherName = getCellString(row.getCell(3), formatter);
                    String volumeNumbers = getCellString(row.getCell(4), formatter);
                    String editionType = getCellString(row.getCell(5), formatter);
                    Integer publicationYear = getCellInteger(row.getCell(6), formatter);
                    if (publicationYear != null && (publicationYear < 1000 || publicationYear > 9999)) {
                        publicationYear = null;
                    }
                    Integer conditionPercent = getCellInteger(row.getCell(7), formatter);
                    BigDecimal price = getCellBigDecimal(row.getCell(8), formatter);
                    Integer stockQuantity = getCellInteger(row.getCell(9), formatter);
                    String listingTypeStr = getCellString(row.getCell(10), formatter);
                    String tradeWishNote = getCellString(row.getCell(11), formatter);
                    String description = getCellString(row.getCell(12), formatter);
                    String coverImageUrl = getCellString(row.getCell(13), formatter);

                    // Kiểm tra trường bắt buộc
                    if (title == null || title.isBlank()) {
                        errors.add("Dòng " + displayRowNumber + ": Tên truyện không được để trống.");
                        continue;
                    }
                    if (title.length() > 255) {
                        errors.add("Dòng " + displayRowNumber + ": Tên truyện tối đa 255 ký tự.");
                        continue;
                    }
                    if (categoryName == null || categoryName.isBlank()) {
                        errors.add("Dòng " + displayRowNumber + ": Thể loại không được để trống.");
                        continue;
                    }
                    if (publisherName == null || publisherName.isBlank()) {
                        errors.add("Dòng " + displayRowNumber + ": Nhà xuất bản không được để trống.");
                        continue;
                    }
                    if (conditionPercent == null || conditionPercent < 0 || conditionPercent > 100) {
                        errors.add("Dòng " + displayRowNumber + ": Độ mới (%) phải là số từ 0 đến 100.");
                        continue;
                    }
                    if (price == null || price.compareTo(BigDecimal.ZERO) < 0) {
                        errors.add("Dòng " + displayRowNumber + ": Giá bán không hợp lệ (phải >= 0 VNĐ).");
                        continue;
                    }
                    if (stockQuantity == null || stockQuantity < 0) {
                        errors.add("Dòng " + displayRowNumber + ": Số lượng tồn kho phải là số không âm (>= 0).");
                        continue;
                    }
                    if (description == null || description.isBlank()) {
                        description = "Sách " + title + (editionType != null ? " (" + editionType + ")" : "");
                    }

                    ListingType listingType = parseListingType(listingTypeStr);

                    SellerProductRequest request = new SellerProductRequest(
                            title.trim(),
                            description.trim(),
                            null,
                            categoryName.trim(),
                            null,
                            authorName != null && !authorName.isBlank() ? authorName.trim() : null,
                            null,
                            publisherName.trim(),
                            volumeNumbers != null && !volumeNumbers.isBlank() ? volumeNumbers.trim() : null,
                            editionType != null && !editionType.isBlank() ? editionType.trim() : null,
                            publicationYear,
                            conditionPercent,
                            price,
                            stockQuantity,
                            listingType,
                            tradeWishNote != null && !tradeWishNote.isBlank() ? tradeWishNote.trim() : null,
                            true
                    );

                    var createdRecord = sellerProductService.create(sellerId, request);
                    String effectiveCover = (coverImageUrl != null && !coverImageUrl.isBlank() && isValidUrl(coverImageUrl))
                            ? coverImageUrl.trim()
                            : DEFAULT_COVER_IMAGE;

                    var p = productRepository.findById(createdRecord.id()).orElse(null);
                    if (p != null) {
                        p.setCoverImageUrl(effectiveCover);
                        productRepository.saveAndFlush(p);

                        ProductImage coverImage = new ProductImage();
                        coverImage.setProductId(p.getId());
                        coverImage.setImageUrl(effectiveCover);
                        coverImage.setImageType(ProductImageType.COVER);
                        coverImage.setDisplayOrder(0);
                        productImageRepository.save(coverImage);
                    }

                    successCount++;
                } catch (Exception rowEx) {
                    String msg = rowEx.getMessage();
                    if (rowEx instanceof ResponseStatusException rse && rse.getReason() != null) {
                        msg = rse.getReason();
                    }
                    errors.add("Dòng " + displayRowNumber + ": " + (msg != null ? msg : "Dữ liệu không hợp lệ."));
                }
            }
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lỗi đọc file Excel: " + ex.getMessage());
        }

        int errorCount = errors.size();
        String message;
        if (totalRows == 0) {
            message = "File Excel không có dòng dữ liệu sản phẩm nào.";
        } else if (errorCount == 0) {
            message = "Nhập thành công toàn bộ " + successCount + " sản phẩm vào gian hàng.";
        } else if (successCount == 0) {
            message = "Không có sản phẩm nào được nhập thành công (" + errorCount + " dòng lỗi).";
        } else {
            message = "Đã nhập thành công " + successCount + "/" + totalRows + " sản phẩm. Có " + errorCount + " dòng bị lỗi.";
        }

        return new SellerProductImportResult(totalRows, successCount, errorCount, errors, message);
    }

    private void createCell(Row row, int colIndex, String value, CellStyle style) {
        Cell cell = row.createCell(colIndex);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

    private void createNumericCell(Row row, int colIndex, double value, CellStyle style) {
        Cell cell = row.createCell(colIndex);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    private boolean isRowEmpty(Row row, DataFormatter formatter) {
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) {
                String val = formatter.formatCellValue(cell).trim();
                if (!val.isEmpty()) return false;
            }
        }
        return true;
    }

    private String getCellString(Cell cell, DataFormatter formatter) {
        if (cell == null) return null;
        String val = formatter.formatCellValue(cell);
        return (val != null && !val.trim().isEmpty()) ? val.trim() : null;
    }

    private Integer getCellInteger(Cell cell, DataFormatter formatter) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            return (int) Math.round(cell.getNumericCellValue());
        }
        String text = formatter.formatCellValue(cell).replaceAll("[^0-9-]", "").trim();
        if (text.isEmpty()) return null;
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private BigDecimal getCellBigDecimal(Cell cell, DataFormatter formatter) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            return BigDecimal.valueOf(cell.getNumericCellValue());
        }
        String text = formatter.formatCellValue(cell)
                .replace("₫", "").replace("đ", "").replace("Đ", "")
                .replace(",", "").replace(".", "").trim();
        if (text.isEmpty()) return null;
        try {
            return new BigDecimal(text);
        } catch (Exception e) {
            return null;
        }
    }

    private ListingType parseListingType(String str) {
        if (str == null || str.isBlank()) return ListingType.SELL;
        String lower = str.toLowerCase().trim();
        if (lower.contains("cả hai") || lower.contains("ca hai") || lower.contains("both") || lower.contains("sell_and_trade")) {
            return ListingType.SELL_AND_TRADE;
        }
        if (lower.contains("đổi") || lower.contains("doi") || lower.contains("trade")) {
            return ListingType.TRADE;
        }
        return ListingType.SELL;
    }

    private boolean isValidUrl(String url) {
        if (url == null) return false;
        String trimmed = url.trim().toLowerCase();
        return trimmed.startsWith("http://") || trimmed.startsWith("https://");
    }
}
