-- ResellVault Database Schema
-- C237 CA2 Team Project

CREATE DATABASE IF NOT EXISTS resellvault;
USE resellvault;

-- users table (structure only — login/auth logic will be added once that lesson is covered in class)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL, -- plain column for now, hashing added later once that lesson is covered
    role ENUM('buyer', 'seller', 'admin') DEFAULT 'buyer'
);

-- products table
CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    condition_type ENUM('new', 'used') DEFAULT 'used',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    quantity INT DEFAULT 1,
    is_free BOOLEAN DEFAULT FALSE,
    delivery_method ENUM('meetup', 'delivery', 'both') DEFAULT 'meetup',
    meetup_location VARCHAR(255),
    status ENUM('available', 'sold_out') DEFAULT 'available',
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(user_id)
);

-- TODO: an "orders" table will be added later once the team finalizes that part of the schema

-- Sample data to test the example GET / route
INSERT INTO users (username, email, password, role) VALUES
('seller_demo', 'seller@example.com', 'password123', 'seller');

INSERT INTO products (seller_id, name, description, category, condition_type, price, quantity, is_free, delivery_method, meetup_location, status, image) VALUES
(1, 'Charizard Holo Card', 'Base set, near mint condition', 'Trading Cards', 'used', 150.00, 1, FALSE, 'both', 'Bugis MRT', 'available', 'placeholder.png'),
(1, 'Vintage Denim Jacket', 'Size M, lightly worn', 'Clothing', 'used', 45.00, 2, FALSE, 'meetup', 'Orchard MRT', 'available', 'placeholder.png');
