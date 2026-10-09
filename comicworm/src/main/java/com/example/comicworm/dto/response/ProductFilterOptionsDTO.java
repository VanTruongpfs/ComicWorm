package com.example.comicworm.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** Dữ liệu cho thanh lọc bên trái: thể loại / NXB kèm số tin đang hiển thị. */
@Getter
@Builder
public class ProductFilterOptionsDTO {

    private final long totalProducts;
    private final List<CategoryOption> categories;
    private final List<PublisherOption> publishers;

    @Getter
    @Builder
    public static class CategoryOption {
        private final Integer id;
        private final String name;
        private final String slug;
        private final Integer parentId;
        /** Với thể loại cha: đã cộng cả thể loại con. */
        private final long count;
    }

    @Getter
    @Builder
    public static class PublisherOption {
        private final Integer id;
        private final String name;
        private final String slug;
        private final long count;
    }
}
