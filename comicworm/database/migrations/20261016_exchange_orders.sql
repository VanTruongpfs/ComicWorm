-- Additive migration. Select the application's database before running this file.
CREATE TABLE IF NOT EXISTS user_addresses (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    province VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    ward VARCHAR(100) NOT NULL,
    address_detail VARCHAR(500) NOT NULL,
    default_address BOOLEAN NOT NULL DEFAULT FALSE,
    KEY idx_user_addresses (user_id),
    CONSTRAINT fk_address_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exchange_order_links (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    offer_id BIGINT NOT NULL,
    recipient_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL UNIQUE,
    shipping_method VARCHAR(30) NOT NULL,
    UNIQUE KEY uq_exchange_recipient (room_id, recipient_id),
    CONSTRAINT fk_exchange_order_room FOREIGN KEY (room_id) REFERENCES exchange_rooms(id),
    CONSTRAINT fk_exchange_order_offer FOREIGN KEY (offer_id) REFERENCES exchange_offers(id),
    CONSTRAINT fk_exchange_order_recipient FOREIGN KEY (recipient_id) REFERENCES users(id),
    CONSTRAINT fk_exchange_order_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
