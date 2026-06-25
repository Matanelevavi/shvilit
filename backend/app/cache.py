"""
Cache מקומי ב-SQLite (במקום Supabase, כי אין service_role key בשלב זה).
מבנה הטבלה זהה במהותו לסכמת Supabase שב-supabase_schema.sql.

דפוס חיבור: autocommit (isolation_level=None) + סגירת חיבור בכל קריאה + נעילה.
כך כתיבות נראות מיד לקריאות הבאות, ואין דליפת חיבורים תחת עומס.
"""
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from typing import Iterator, Optional

from .config import DB_PATH

_lock = threading.Lock()


@contextmanager
def _db() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    try:
        with _lock:
            yield conn
    finally:
        conn.close()


def init_db() -> None:
    with _db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tours (
                id TEXT PRIMARY KEY,
                location TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                style TEXT NOT NULL,
                status TEXT NOT NULL,
                video_url TEXT,
                error TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE (location, duration_minutes, style)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS quizzes (
                location TEXT PRIMARY KEY,
                questions TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )


def _normalize(location: str) -> str:
    return location.strip().lower()


def find(location: str, duration_minutes: int, style: str) -> Optional[sqlite3.Row]:
    with _db() as conn:
        cur = conn.execute(
            "SELECT * FROM tours WHERE location = ? AND duration_minutes = ? AND style = ?",
            (_normalize(location), duration_minutes, style),
        )
        return cur.fetchone()


def get_by_id(tour_id: str) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute("SELECT * FROM tours WHERE id = ?", (tour_id,)).fetchone()


def create_processing(location: str, duration_minutes: int, style: str) -> str:
    tour_id = uuid.uuid4().hex
    with _db() as conn:
        conn.execute(
            """
            INSERT INTO tours (id, location, duration_minutes, style, status)
            VALUES (?, ?, ?, ?, 'processing')
            """,
            (tour_id, _normalize(location), duration_minutes, style),
        )
    return tour_id


def mark_completed(tour_id: str, video_url: str) -> None:
    with _db() as conn:
        conn.execute(
            "UPDATE tours SET status='completed', video_url=?, error=NULL, updated_at=datetime('now') WHERE id=?",
            (video_url, tour_id),
        )


def mark_failed(tour_id: str, error: str) -> None:
    with _db() as conn:
        conn.execute(
            "UPDATE tours SET status='failed', error=?, updated_at=datetime('now') WHERE id=?",
            (error[:500], tour_id),
        )


def delete(tour_id: str) -> None:
    with _db() as conn:
        conn.execute("DELETE FROM tours WHERE id=?", (tour_id,))


def get_quiz(location: str) -> Optional[str]:
    with _db() as conn:
        row = conn.execute(
            "SELECT questions FROM quizzes WHERE location = ?", (_normalize(location),)
        ).fetchone()
        return row["questions"] if row else None


def save_quiz(location: str, questions_json: str) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO quizzes (location, questions) VALUES (?, ?)",
            (_normalize(location), questions_json),
        )
