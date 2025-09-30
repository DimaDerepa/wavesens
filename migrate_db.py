#!/usr/bin/env python3
"""
Database migration script - fix significance_score field type
"""
import sys
import os

# Add environment variable support
try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass

# Get DATABASE_URL from Railway environment or .env
database_url = os.getenv('DATABASE_URL')

if not database_url:
    print("ERROR: DATABASE_URL not found in environment")
    print("Get it from Railway: railway variables --service news_analyzer | grep DATABASE_URL")
    sys.exit(1)

try:
    import psycopg2

    print(f"Connecting to database...")
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    print("Executing ALTER TABLE to fix significance_score field...")
    cur.execute("""
        ALTER TABLE news_items
        ALTER COLUMN significance_score TYPE DECIMAL(5,2);
    """)

    conn.commit()
    print("✅ Migration successful!")

    # Verify the change
    cur.execute("""
        SELECT column_name, data_type, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_name = 'news_items' AND column_name = 'significance_score';
    """)

    result = cur.fetchone()
    print(f"✅ Verified: {result}")

    cur.close()
    conn.close()

except Exception as e:
    print(f"❌ Migration failed: {e}")
    sys.exit(1)