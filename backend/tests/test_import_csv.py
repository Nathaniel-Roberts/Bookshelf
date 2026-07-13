GOODREADS_CSV = (
    "Title,Author,Additional Authors,ISBN,ISBN13,My Rating,Publisher,"
    "Number of Pages,Year Published,Exclusive Shelf,Bookshelves\n"
    'The Hobbit,J.R.R. Tolkien,,"=""0261103283""","=""9780261103283""",5,'
    "Allen & Unwin,310,1937,read,fantasy\n"
    'Dune,Frank Herbert,,"=""""","=""9780441172719""",0,Ace,412,1965,to-read,\n'
    'No ISBN Book,Someone Obscure,,"=""""","=""""",3,,,,currently-reading,\n'
)

STORYGRAPH_CSV = '''Title,Authors,ISBN/UID,Format,Read Status,Star Rating
Neuromancer,William Gibson,9780441569595,paperback,read,4.5
Some Novel,Jane Writer,,paperback,to-read,
'''


async def test_goodreads_import(client, admin_headers):
    resp = await client.post(
        "/api/books/import-csv",
        files={"file": ("goodreads.csv", GOODREADS_CSV, "text/csv")},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"imported": 3, "skipped": 0, "enriching": 0}

    books = {b["title"]: b for b in (await client.get("/api/books")).json()}
    hobbit = books["The Hobbit"]
    assert hobbit["isbn13"] == "9780261103283"
    assert hobbit["rating"] == 5
    assert hobbit["status"] == "read"
    assert hobbit["publisher"] == "Allen & Unwin"
    assert hobbit["page_count"] == 310

    assert books["Dune"]["status"] == "want"
    assert books["Dune"]["rating"] is None
    assert books["No ISBN Book"]["status"] == "reading"
    assert books["No ISBN Book"]["isbn13"] is None


async def test_storygraph_import_and_dedupe(client, admin_headers):
    resp = await client.post(
        "/api/books/import-csv",
        files={"file": ("storygraph.csv", STORYGRAPH_CSV, "text/csv")},
        headers=admin_headers,
    )
    assert resp.json()["imported"] == 2

    books = {b["title"]: b for b in (await client.get("/api/books")).json()}
    assert books["Neuromancer"]["isbn13"] == "9780441569595"
    assert books["Neuromancer"]["rating"] == 4  # 4.5 rounds banker's to 4
    assert books["Neuromancer"]["status"] == "read"

    # Re-importing the same file skips everything
    resp = await client.post(
        "/api/books/import-csv",
        files={"file": ("storygraph.csv", STORYGRAPH_CSV, "text/csv")},
        headers=admin_headers,
    )
    assert resp.json() == {"imported": 0, "skipped": 2, "enriching": 0}


async def test_unknown_csv_rejected(client, admin_headers):
    resp = await client.post(
        "/api/books/import-csv",
        files={"file": ("random.csv", "a,b,c\n1,2,3\n", "text/csv")},
        headers=admin_headers,
    )
    assert resp.status_code == 422


async def test_import_requires_admin(client):
    resp = await client.post(
        "/api/books/import-csv", files={"file": ("x.csv", "Title\n", "text/csv")}
    )
    assert resp.status_code in (401, 403)
