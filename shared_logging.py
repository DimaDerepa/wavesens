#!/usr/bin/env python3
"""
Shared logging configuration for all WaveSens services
Ensures all real logs from services are captured to database
"""
import logging
import os
import psycopg2
import psycopg2.extras
from datetime import datetime

class DatabaseLogHandler(logging.Handler):
    def __init__(self, service_name="unknown"):
        super().__init__()
        self.service_name = service_name
        self.database_url = os.getenv('DATABASE_URL', 'postgresql://localhost/news_analyzer')

    def get_connection(self):
        return psycopg2.connect(
            self.database_url,
            cursor_factory=psycopg2.extras.RealDictCursor
        )

    def emit(self, record):
        try:
            # Format the log message
            message = self.format(record)

            # Save to database
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO application_logs (timestamp, level, message, service)
                VALUES (%s, %s, %s, %s)
            """, (
                datetime.fromtimestamp(record.created),
                record.levelname,
                message,
                self.service_name
            ))
            conn.commit()
            conn.close()

            # Also print to stderr so it shows up in Railway logs
            print(f"[{self.service_name}] {message}", file=__import__('sys').stderr)

        except Exception as e:
            # Don't crash on logging errors, just print to stderr
            print(f"[{self.service_name}] DB_LOG_ERROR: {e}", file=__import__('sys').stderr)
            # Still print the original message
            print(f"[{self.service_name}] {self.format(record)}", file=__import__('sys').stderr)

def setup_database_logging(service_name):
    """Setup database logging for a service"""
    try:
        # Create database log handler
        db_handler = DatabaseLogHandler(service_name)
        db_handler.setLevel(logging.DEBUG)  # Capture ALL logs

        # Add formatter to match current format
        formatter = logging.Formatter('[%(asctime)s] %(levelname)s - %(message)s',
                                    datefmt='%Y-%m-%d %H:%M:%S')
        db_handler.setFormatter(formatter)

        # Add handler to root logger to catch all logs
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.DEBUG)  # Make sure root logger accepts ALL logs
        root_logger.addHandler(db_handler)

        print(f"Database logging enabled for {service_name}")
    except Exception as e:
        print(f"Failed to setup database logging for {service_name}: {e}")