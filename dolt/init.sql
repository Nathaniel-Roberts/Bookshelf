CREATE USER IF NOT EXISTS 'bookshelf'@'%' IDENTIFIED WITH mysql_native_password BY 'bookshelf';
GRANT ALL PRIVILEGES ON *.* TO 'bookshelf'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;

CREATE DATABASE IF NOT EXISTS bookshelf;
USE bookshelf;

CREATE TABLE IF NOT EXISTS series (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
    id CHAR(36) PRIMARY KEY,
    isbn13 VARCHAR(13) UNIQUE,
    isbn10 VARCHAR(10),
    title VARCHAR(500) NOT NULL,
    subtitle VARCHAR(500),
    authors JSON,
    publisher VARCHAR(255),
    publish_date VARCHAR(50),
    description TEXT,
    page_count INT,
    cover_url VARCHAR(1000),
    cover_local VARCHAR(255),
    genres JSON,
    language VARCHAR(10),
    series_id CHAR(36),
    series_position VARCHAR(10),
    tags JSON,
    is_favourite BOOLEAN DEFAULT FALSE,
    rating TINYINT,
    notes TEXT,
    metadata_source ENUM('openlibrary', 'googlebooks', 'manual') DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS copies (
    id CHAR(36) PRIMARY KEY,
    book_id CHAR(36) NOT NULL,
    barcode VARCHAR(50) NOT NULL UNIQUE,
    barcode_format ENUM('code128', 'qr') DEFAULT 'code128',
    location VARCHAR(255),
    `condition` ENUM('new', 'like_new', 'good', 'fair', 'poor'),
    acquisition_date DATE,
    acquisition_price DECIMAL(10, 2),
    acquisition_source VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loans (
    id CHAR(36) PRIMARY KEY,
    copy_id CHAR(36) NOT NULL,
    borrower_name VARCHAR(255) NOT NULL,
    borrowed_date DATE NOT NULL,
    returned_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (copy_id) REFERENCES copies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    value TEXT
);

INSERT IGNORE INTO settings (`key`, value) VALUES
    ('prefer_google_books', 'false'),
    ('default_barcode_format', 'code128'),
    ('library_name', 'Our Bookshelf');

CALL DOLT_ADD('-A');
CALL DOLT_COMMIT('-m', 'Initialize database schema', '--author', 'bookshelf <bookshelf@local>');
