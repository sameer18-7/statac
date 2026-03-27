"""
═══════════════════════════════════════════════════════════
STATAC — CSV to MongoDB Ingestion Script
Reads cricket_data.csv and loads it into MongoDB.
Uses only built-in Python modules + pymongo.
═══════════════════════════════════════════════════════════
"""

import csv
import os
import sys
import time
import math

try:
    from pymongo import MongoClient, UpdateOne
except ImportError:
    print("❌ pymongo is not installed. Run: pip install pymongo")
    sys.exit(1)


# ─── Configuration ───────────────────────────────────────────
CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Dataset", "cricket_data.csv")
MONGO_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/statac")
DB_NAME = "statac"
COLLECTION = "players"
BATCH_SIZE = 500


def safe_float(value):
    """Convert a value to float safely. Returns 0 for invalid/missing."""
    if not value or value.strip() in ("", "-"):
        return 0
    try:
        return float(value.replace(",", ""))
    except (ValueError, AttributeError):
        return 0


def calculate_impact_score(row):
    """
    Calculate a normalized Impact Score (0-99) based on batting and bowling.
    Uses batting runs, average, strike rate, centuries, and bowling wickets.
    """
    # Batting components
    bat_runs = (
        safe_float(row.get("BATTING_Tests_Runs", "0"))
        + safe_float(row.get("BATTING_ODIs_Runs", "0"))
        + safe_float(row.get("BATTING_T20Is_Runs", "0"))
    )
    bat_avg = max(
        safe_float(row.get("BATTING_Tests_Ave", "0")),
        safe_float(row.get("BATTING_ODIs_Ave", "0")),
        safe_float(row.get("BATTING_T20Is_Ave", "0")),
    )
    bat_sr = max(
        safe_float(row.get("BATTING_T20Is_SR", "0")),
        safe_float(row.get("BATTING_ODIs_SR", "0")),
    )
    centuries = (
        safe_float(row.get("BATTING_Tests_100", "0"))
        + safe_float(row.get("BATTING_ODIs_100", "0"))
        + safe_float(row.get("BATTING_T20Is_100", "0"))
    )

    # Bowling components
    bowl_wkts = (
        safe_float(row.get("BOWLING_Tests_Wkts", "0"))
        + safe_float(row.get("BOWLING_ODIs_Wkts", "0"))
        + safe_float(row.get("BOWLING_T20Is_Wkts", "0"))
    )

    # Weighted score calculation
    score = 0
    score += min(bat_runs / 250, 25)        # max 25 pts from runs
    score += min(bat_avg / 2, 20)            # max 20 pts from average
    score += min(bat_sr / 10, 15)            # max 15 pts from strike rate
    score += min(centuries * 2, 15)          # max 15 pts from centuries
    score += min(bowl_wkts / 15, 20)         # max 20 pts from wickets
    score += 5                                # base score

    return min(int(round(score)), 99)


def clean_row(row):
    """Clean and normalize a CSV row for MongoDB insertion."""
    cleaned = {}
    for key, value in row.items():
        if not key:
            continue
        # Strip whitespace from keys and values
        k = key.strip()
        v = value.strip() if isinstance(value, str) else value
        cleaned[k] = v

    # Add computed fields
    cleaned["_impact_score"] = calculate_impact_score(cleaned)

    # Add search-friendly lowercase name
    name = cleaned.get("NAME", "")
    cleaned["_name_lower"] = name.lower() if name else ""

    # Compute total international runs
    total_runs = (
        safe_float(cleaned.get("BATTING_Tests_Runs", "0"))
        + safe_float(cleaned.get("BATTING_ODIs_Runs", "0"))
        + safe_float(cleaned.get("BATTING_T20Is_Runs", "0"))
    )
    cleaned["_total_intl_runs"] = total_runs

    # Compute total international wickets
    total_wkts = (
        safe_float(cleaned.get("BOWLING_Tests_Wkts", "0"))
        + safe_float(cleaned.get("BOWLING_ODIs_Wkts", "0"))
        + safe_float(cleaned.get("BOWLING_T20Is_Wkts", "0"))
    )
    cleaned["_total_intl_wickets"] = total_wkts

    return cleaned


def main():
    print("═" * 56)
    print("  STATAC — Data Ingestion Pipeline")
    print("═" * 56)
    print()

    # Check CSV exists
    if not os.path.exists(CSV_PATH):
        print(f"❌ CSV file not found at: {CSV_PATH}")
        sys.exit(1)

    print(f"📂 CSV: {CSV_PATH}")
    csv_size_mb = os.path.getsize(CSV_PATH) / (1024 * 1024)
    print(f"   Size: {csv_size_mb:.1f} MB")
    print(f"🔗 MongoDB: {MONGO_URI}")
    print()

    # Connect to MongoDB
    print("⏳ Connecting to MongoDB...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Force connection test
        client.admin.command("ping")
        print("✅ MongoDB connected!")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        print()
        print("💡 Make sure MongoDB is running:")
        print("   • Local: mongod --dbpath <your-data-path>")
        print("   • Atlas: Update MONGODB_URI in .env with your Atlas URI")
        sys.exit(1)

    db = client[DB_NAME]
    collection = db[COLLECTION]

    # Read CSV
    print()
    print("⏳ Reading CSV file...")
    start_time = time.time()

    rows = []
    with open(CSV_PATH, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned = clean_row(row)
            if cleaned.get("NAME"):  # Only add rows with a name
                rows.append(cleaned)

    read_time = time.time() - start_time
    print(f"✅ Read {len(rows):,} players in {read_time:.1f}s")

    # Ingest into MongoDB
    print()
    print("⏳ Upserting data into MongoDB...")
    start_time = time.time()

    # Use upsert to avoid duplicates on re-run
    operations = []
    for row in rows:
        operations.append(
            UpdateOne(
                {"NAME": row["NAME"]},  # match on name
                {"$set": row},          # update all fields
                upsert=True             # insert if doesn't exist
            )
        )

    # Process in batches
    total_modified = 0
    total_upserted = 0
    num_batches = math.ceil(len(operations) / BATCH_SIZE)

    for i in range(0, len(operations), BATCH_SIZE):
        batch = operations[i : i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        result = collection.bulk_write(batch)
        total_modified += result.modified_count
        total_upserted += result.upserted_count
        progress = min(100, int((batch_num / num_batches) * 100))
        print(f"   Batch {batch_num}/{num_batches} — {progress}%", end="\r")

    ingest_time = time.time() - start_time
    print()
    print(f"✅ Ingestion complete in {ingest_time:.1f}s")
    print(f"   → Inserted: {total_upserted:,}")
    print(f"   → Updated: {total_modified:,}")

    # Create indexes
    print()
    print("⏳ Creating indexes...")
    collection.create_index("NAME")
    collection.create_index("_name_lower")
    collection.create_index("COUNTRY")
    collection.create_index("_impact_score")
    collection.create_index([("NAME", "text")])
    print("✅ Indexes created!")

    # Summary
    total_count = collection.count_documents({})
    countries = len(collection.distinct("COUNTRY"))

    print()
    print("═" * 56)
    print(f"  ✅ STATAC Database Ready!")
    print(f"  → Total players: {total_count:,}")
    print(f"  → Countries: {countries}")
    print(f"  → Database: {DB_NAME}")
    print(f"  → Collection: {COLLECTION}")
    print("═" * 56)
    print()
    print("🚀 You can now run: npm run dev")


if __name__ == "__main__":
    main()
