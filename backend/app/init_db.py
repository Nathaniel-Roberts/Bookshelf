import sys

from sqlalchemy import text

from app.database import engine

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS series (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
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
        status ENUM('owned', 'want', 'reading', 'read') DEFAULT 'owned',
        is_favourite BOOLEAN DEFAULT FALSE,
        rating TINYINT,
        notes TEXT,
        metadata_source ENUM('openlibrary', 'googlebooks', 'manual') DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL
    )
    """,
    """
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
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS loans (
        id CHAR(36) PRIMARY KEY,
        copy_id CHAR(36) NOT NULL,
        borrower_name VARCHAR(255) NOT NULL,
        borrowed_date DATE NOT NULL,
        due_date DATE,
        returned_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (copy_id) REFERENCES copies(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS settings (
        `key` VARCHAR(100) PRIMARY KEY,
        value TEXT
    )
    """,
    """
    INSERT IGNORE INTO settings (`key`, value) VALUES
        ('prefer_google_books', 'false'),
        ('default_barcode_format', 'code128'),
        ('library_name', 'Our Bookshelf')
    """,
]


# (name, table, column) — MySQL has no CREATE INDEX IF NOT EXISTS, so
# existence is checked via information_schema first.
SECONDARY_INDEXES = [
    ("idx_loans_returned_date", "loans", "returned_date"),
    ("idx_books_title", "books", "title"),
]

# (table, column, definition) — columns added after the original schema
# shipped; applied to existing databases via information_schema check.
MIGRATED_COLUMNS = [
    ("loans", "due_date", "DATE"),
    ("books", "status", "ENUM('owned', 'want', 'reading', 'read') DEFAULT 'owned'"),
]


async def _ensure_columns(conn):
    for table, column, definition in MIGRATED_COLUMNS:
        result = await conn.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column"
            ),
            {"table": table, "column": column},
        )
        if result.scalar() == 0:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


async def _ensure_indexes(conn):
    for name, table, column in SECONDARY_INDEXES:
        result = await conn.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.statistics "
                "WHERE table_schema = DATABASE() AND table_name = :table AND index_name = :name"
            ),
            {"table": table, "name": name},
        )
        if result.scalar() == 0:
            await conn.execute(text(f"CREATE INDEX {name} ON {table} ({column})"))


async def init_db():
    """Create tables if they don't exist. Safe to run on every startup."""
    async with engine.begin() as conn:
        for statement in SCHEMA_STATEMENTS:
            await conn.execute(text(statement))
        await _ensure_columns(conn)
        await _ensure_indexes(conn)
        # Dolt commit the schema
        await conn.execute(text("CALL DOLT_ADD('-A')"))
        try:
            await conn.execute(
                text(
                    "CALL DOLT_COMMIT('-m', 'Initialize database schema', "
                    "'--allow-empty', '--author', 'bookshelf <bookshelf@local>')"
                )
            )
        except Exception:
            pass  # Already committed, no changes
    print("Database initialized.", file=sys.stderr)
