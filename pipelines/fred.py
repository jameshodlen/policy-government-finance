"""
FRED (Federal Reserve Bank of St. Louis)
Endpoint: api.stlouisfed.org/fred/ (free API key)
Data: 812,000+ economic time series — mirrors Census, BEA, and other sources
Update: Varies | Lag: Mirrors sources
"""

import logging
import requests

from pipelines.config import FRED_API_KEY
from pipelines.utils import (
    RateLimiter, load_cached, save_cache, write_site_json,
    update_manifest,
)

logger = logging.getLogger("pipeline.fred")

BASE_URL = "https://api.stlouisfed.org/fred"
rate_limiter = RateLimiter(requests_per_second=2)

# Key FRED series for state fiscal context
SERIES_IDS = {
    # National economic indicators
    "GDP": "GDP",
    "UNRATE": "UNRATE",
    "CPIAUCSL": "CPIAUCSL",
    "FEDFUNDS": "FEDFUNDS",
    "GS10": "GS10",
    # State-level series follow pattern: {INDICATOR}{STATE_ABBREV}
    # e.g., WINGSP = Wisconsin Gross State Product
}

# State GDP series IDs (quarterly)
STATE_GDP_SERIES = {
    "WI": "WINGSP",
    "MN": "MNGSP",
    "IL": "ILNGSP",
    "CA": "CANGSP",
    "TX": "TXNGSP",
    "NY": "NYNGSP",
    "FL": "FLNGSP",
    "OH": "OHNGSP",
    "PA": "PANGSP",
    "NJ": "NJNGSP",
}


def fetch_series(series_id, start_date="2015-01-01"):
    """Fetch a FRED time series."""
    if not FRED_API_KEY:
        logger.warning("No FRED_API_KEY set. Skipping live fetch.")
        return None

    cache_key = f"series_{series_id}_{start_date}"
    cached = load_cached("fred", cache_key, max_age_hours=168)
    if cached:
        return cached

    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": start_date,
    }

    try:
        rate_limiter.wait()
        logger.info(f"Fetching FRED series {series_id}...")
        resp = requests.get(f"{BASE_URL}/series/observations", params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        save_cache("fred", cache_key, data)
        return data
    except requests.RequestException as e:
        logger.error(f"FRED API error for {series_id}: {e}")
        return None


def transform(series_results):
    """Transform raw FRED responses into usable records."""
    records = {}
    for series_id, data in series_results.items():
        if not data or "observations" not in data:
            continue
        observations = []
        for obs in data["observations"]:
            try:
                observations.append({
                    "date": obs["date"],
                    "value": float(obs["value"]) if obs["value"] != "." else None,
                })
            except (ValueError, KeyError):
                continue
        records[series_id] = observations
    return records


def output(records):
    """Write processed FRED data."""
    write_site_json(
        {
            "source": "Federal Reserve Bank of St. Louis (FRED)",
            "series": records,
            "sample": len(records) == 0,
        },
        "fred_economic_series.json",
    )
    update_manifest("fred",
                    status="success" if records else "no_api_key",
                    record_count=sum(len(v) for v in records.values()))


def run():
    """Run the full FRED pipeline."""
    logger.info("Running FRED pipeline...")
    results = {}
    # Fetch national indicators
    for label, sid in SERIES_IDS.items():
        data = fetch_series(sid)
        if data:
            results[sid] = data
    # Fetch state GDP series
    for abbrev, sid in STATE_GDP_SERIES.items():
        data = fetch_series(sid)
        if data:
            results[sid] = data

    records = transform(results)
    output(records)
    logger.info(f"FRED pipeline complete: {len(records)} series")
    return records


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
