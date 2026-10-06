-- Reference data for the document-scoped schema. Run once after schema.sql.
USE bookmooch_db_v3;
SET NAMES utf8mb4;
START TRANSACTION;
INSERT INTO categories (id,name,slug) VALUES
(1,'Manga','manga'),(2,'Manhwa','manhwa'),(3,'Truyện thiếu nhi','truyen-thieu-nhi'),(4,'Truyện xưa hiếm','truyen-xua-hiem');
INSERT INTO publishers (id,name,slug) VALUES
(1,'NXB Kim Đồng','nxb-kim-dong'),(2,'NXB Trẻ','nxb-tre'),(3,'IPM','ipm');
INSERT INTO authors (id,name) VALUES
(1,'Takehiko Inoue'),(2,'Eiichiro Oda'),(3,'Fujiko F. Fujio');
COMMIT;
