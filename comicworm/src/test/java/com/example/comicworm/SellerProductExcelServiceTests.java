package com.example.comicworm;

import com.example.comicworm.dto.request.SellerProductRequest;
import com.example.comicworm.dto.response.SellerProductRecord;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.service.seller.SellerProductExcelService;
import com.example.comicworm.service.seller.SellerProductService;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.example.comicworm.model.ProductImage;
import com.example.comicworm.repository.ProductImageRepository;

class SellerProductExcelServiceTests {

    private SellerProductService sellerProductService;
    private ProductRepository productRepository;
    private ProductImageRepository productImageRepository;
    private SellerProductExcelService excelService;

    @BeforeEach
    void setUp() {
        sellerProductService = mock(SellerProductService.class);
        productRepository = mock(ProductRepository.class);
        productImageRepository = mock(ProductImageRepository.class);
        excelService = new SellerProductExcelService(sellerProductService, productRepository, productImageRepository);
    }

    @Test
    void testGenerateTemplate() throws Exception {
        byte[] bytes = excelService.generateTemplate();
        assertNotNull(bytes);
        assertTrue(bytes.length > 0);

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertEquals(2, workbook.getNumberOfSheets());
            assertEquals("Danh Sách Sản Phẩm", workbook.getSheetAt(0).getSheetName());
            assertEquals("Hướng Dẫn Điền Dữ Liệu", workbook.getSheetAt(1).getSheetName());

            var sheet = workbook.getSheetAt(0);
            var headerRow = sheet.getRow(0);
            assertNotNull(headerRow);
            assertEquals("Tên truyện / Sản phẩm (*)", headerRow.getCell(0).getStringCellValue());
            assertEquals(14, headerRow.getLastCellNum());

            // Có 2 dòng mẫu
            assertEquals(2, sheet.getLastRowNum());
        }
    }

    @Test
    void testImportEmptyFileThrowsException() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "test.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new byte[0]);
        assertThrows(ResponseStatusException.class, () -> excelService.importExcel(100L, emptyFile));
    }

    @Test
    void testImportInvalidExtensionThrowsException() {
        MockMultipartFile txtFile = new MockMultipartFile("file", "test.txt", "text/plain", "hello".getBytes());
        assertThrows(ResponseStatusException.class, () -> excelService.importExcel(100L, txtFile));
    }

    @Test
    void testImportValidTemplateFile() throws Exception {
        byte[] templateBytes = excelService.generateTemplate();
        MockMultipartFile excelFile = new MockMultipartFile("file", "products.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", templateBytes);

        SellerProductRecord dummyRecord = new SellerProductRecord(
                1L, "Conan", "Desc", 1, 1, 1, "Tập 100", "Bản đặc biệt",
                2023, 98, new BigDecimal("45000"), 5, ListingType.SELL, null,
                true, ModerationStatus.PENDING, null, null,
                LocalDateTime.now(), LocalDateTime.now(), null, List.of(), List.of()
        );

        when(sellerProductService.create(eq(100L), any(SellerProductRequest.class))).thenReturn(dummyRecord);
        when(productRepository.findById(1L)).thenReturn(Optional.of(new Product()));

        var result = excelService.importExcel(100L, excelFile);

        assertNotNull(result);
        assertEquals(2, result.totalRows());
        assertEquals(2, result.successCount());
        assertEquals(0, result.errorCount());
        assertTrue(result.errors().isEmpty());
        assertTrue(result.message().contains("thành công"));

        verify(sellerProductService, times(2)).create(eq(100L), any(SellerProductRequest.class));
        verify(productImageRepository, times(2)).save(any(ProductImage.class));
    }
}
