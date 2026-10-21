-- Select the application's database before running this file.
-- This file only installs the procedure. It does not delete any products.
-- Run explicitly afterwards: CALL soft_delete_all_products();
-- The caller controls its transaction; the procedure does not commit it.

DROP PROCEDURE IF EXISTS soft_delete_all_products;

DELIMITER $$
CREATE PROCEDURE soft_delete_all_products()
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    DECLARE previous_safe_updates BOOLEAN DEFAULT @@SESSION.sql_safe_updates;
    DECLARE affected_products BIGINT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        SET SESSION sql_safe_updates = previous_safe_updates;
        RESIGNAL;
    END;

    SET SESSION sql_safe_updates = 0;
    UPDATE products
    SET is_active = FALSE,
        deleted_at = UTC_TIMESTAMP()
    WHERE deleted_at IS NULL;

    SET affected_products = ROW_COUNT();
    SET SESSION sql_safe_updates = previous_safe_updates;
    SELECT affected_products AS deleted_products;
END$$
DELIMITER ;
