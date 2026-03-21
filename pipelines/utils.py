"""
Shared pipeline utilities: rate limiting, caching, fiscal year normalization,
per-capita calculations, validation, JSON output helpers.
"""

import json
import time
import logging
import hashlib
from datetime import datetime
from pathlib import Path

from pipelines.config import (
    DATA_RAW, DATA_PROCESSED, SITE_DATA,
    FISCAL_YEAR_EXCEPTIONS, STATE_FIPS, STATE_NAMES,
)

logger = logging.getLogger("pipeline")


# --- Fiscal Year Normalization ---

def fiscal_year_label(state_abbrev, calendar_year, month):
    """
    Determine fiscal year label for a given state and calendar date.
    Most states: FY starts July 1, so July 2024 = FY2025.
    """
    exc = FISCAL_YEAR_EXCEPTIONS.get(state_abbrev)
    start_month = exc["start_month"] if exc else 7

    if month >= start_month:
        return calendar_year + 1
    return calendar_year


def fiscal_year_note(state_abbrev):
    """Return a note about a state's fiscal year calendar."""
    exc = FISCAL_YEAR_EXCEPTIONS.get(state_abbrev)
    if exc:
        return exc["label"]
    return "July 1 - June 30"


# --- Per-Capita and Ratio Calculations ---

def per_capita(total, population):
    """Calculate per-capita value. Returns None if inputs are invalid."""
    if total is None or population is None or population == 0:
        return None
    return round(total / population, 2)


def as_percent_of(numerator, denominator, decimals=1):
    """Calculate percentage. Returns None if inputs are invalid."""
    if numerator is None or denominator is None or denominator == 0:
        return None
    return round((numerator / denominator) * 100, decimals)


# --- Rate Limiting ---

class RateLimiter:
    """Simple rate limiter for API requests."""

    def __init__(self, requests_per_second=2):
        self.min_interval = 1.0 / requests_per_second
        self.last_request = 0

    def wait(self):
        elapsed = time.time() - self.last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request = time.time()


# --- Caching ---

def cache_path(source_name, params_str):
    """Generate a cache file path based on source and params."""
    cache_dir = DATA_RAW / source_name / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    h = hashlib.md5(params_str.encode()).hexdigest()[:12]
    return cache_dir / f"{h}.json"


def load_cached(source_name, params_str, max_age_hours=24):
    """Load cached response if fresh enough."""
    cp = cache_path(source_name, params_str)
    if not cp.exists():
        return None
    age = time.time() - cp.stat().st_mtime
    if age > max_age_hours * 3600:
        return None
    with open(cp) as f:
        return json.load(f)


def save_cache(source_name, params_str, data):
    """Save API response to cache."""
    cp = cache_path(source_name, params_str)
    with open(cp, "w") as f:
        json.dump(data, f, indent=2)


# --- Output ---

def write_json(data, path, indent=2):
    """Write data to JSON file, creating parent directories."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w") as f:
        json.dump(data, f, indent=indent)
    logger.info(f"Wrote {p}")


def write_site_json(data, relative_path, indent=2):
    """Write data to the site/data/ directory."""
    write_json(data, SITE_DATA / relative_path, indent)


# --- Validation ---

def validate_state_coverage(data, key="abbrev"):
    """Check that all 50 states are represented in a dataset."""
    present = {d[key] for d in data if key in d}
    expected = set(STATE_FIPS.keys())
    missing = expected - present
    extra = present - expected
    if missing:
        logger.warning(f"Missing states: {sorted(missing)}")
    if extra:
        logger.warning(f"Unexpected entries: {sorted(extra)}")
    return len(missing) == 0


def validate_no_nulls(data, required_fields):
    """Check for null values in required fields."""
    issues = []
    for i, d in enumerate(data):
        for field in required_fields:
            if d.get(field) is None:
                issues.append(f"Row {i}: {field} is null")
    if issues:
        logger.warning(f"Null values found: {len(issues)} issues")
    return issues


# --- Manifest ---

def update_manifest(source_name, status="success", record_count=0, notes=""):
    """Update the data manifest with pipeline run metadata."""
    manifest_path = SITE_DATA / "manifest.json"
    manifest = {}
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)

    if "sources" not in manifest:
        manifest["sources"] = {}

    manifest["sources"][source_name] = {
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "status": status,
        "record_count": record_count,
        "notes": notes,
    }
    manifest["last_run"] = datetime.utcnow().isoformat() + "Z"

    write_json(manifest, manifest_path)
