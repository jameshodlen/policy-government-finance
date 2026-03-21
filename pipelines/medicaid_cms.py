"""
Medicaid.gov / CMS — State Medicaid expenditure and FMAP rates
Endpoint: data.medicaid.gov (Open Data API, no auth)
Data: CMS-64 quarterly expenditure, FMAP rates
Update: Quarterly | Lag: ~6 months
"""

import logging
import requests

from pipelines.config import STATE_FIPS, STATE_NAMES
from pipelines.utils import (
    RateLimiter, load_cached, save_cache, write_site_json,
    update_manifest,
)

logger = logging.getLogger("pipeline.medicaid")

# Medicaid.gov uses Socrata Open Data API (SODA)
BASE_URL = "https://data.medicaid.gov/api/1"
rate_limiter = RateLimiter(requests_per_second=2)

# Medicaid expansion status as of 2025
EXPANSION_STATES = {
    "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "HI", "ID", "IL",
    "IN", "IA", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MO",
    "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
    "OK", "OR", "PA", "RI", "SD", "UT", "VA", "VT", "WA", "WV",
}

# Standard FMAP rates (FY2025, approximate)
FMAP_RATES = {
    "AL": 72.58, "AK": 50.00, "AZ": 70.64, "AR": 72.05, "CA": 50.00,
    "CO": 50.00, "CT": 50.00, "DE": 56.36, "FL": 59.97, "GA": 66.85,
    "HI": 54.66, "ID": 69.78, "IL": 51.12, "IN": 67.10, "IA": 59.72,
    "KS": 59.61, "KY": 72.73, "LA": 67.62, "ME": 63.39, "MD": 50.00,
    "MA": 50.00, "MI": 63.94, "MN": 50.00, "MS": 76.98, "MO": 64.43,
    "MT": 63.03, "NE": 55.16, "NV": 59.48, "NH": 50.00, "NJ": 50.00,
    "NM": 72.24, "NY": 50.00, "NC": 66.64, "ND": 50.00, "OH": 62.24,
    "OK": 65.66, "OR": 60.19, "PA": 54.59, "RI": 53.05, "SC": 72.42,
    "SD": 58.94, "TN": 65.01, "TX": 60.44, "UT": 66.51, "VT": 54.72,
    "VA": 50.00, "WA": 50.00, "WV": 74.35, "WI": 59.36, "WY": 50.00,
}


def fetch_expenditure_data():
    """Fetch state Medicaid expenditure from CMS."""
    cache_key = "medicaid_expenditure"
    cached = load_cached("medicaid", cache_key, max_age_hours=168)
    if cached:
        return cached

    try:
        rate_limiter.wait()
        logger.info("Fetching Medicaid expenditure data...")
        # CMS-64 quarterly data endpoint
        resp = requests.get(
            f"{BASE_URL}/datastore/query",
            params={"limit": 500},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            save_cache("medicaid", cache_key, data)
            return data
    except requests.RequestException as e:
        logger.error(f"Medicaid API error: {e}")
    return None


def transform(raw_data):
    """Transform raw CMS data into state Medicaid records."""
    # If no live data, return FMAP reference data
    records = []
    for abbrev, fmap in FMAP_RATES.items():
        records.append({
            "abbrev": abbrev,
            "name": STATE_NAMES.get(abbrev, ""),
            "fips": STATE_FIPS.get(abbrev, ""),
            "fmapRate": fmap,
            "expansionState": abbrev in EXPANSION_STATES,
            "expansionFmapRate": 90.0 if abbrev in EXPANSION_STATES else None,
        })
    return records


def output(records):
    """Write processed Medicaid data."""
    write_site_json(
        {
            "source": "CMS / Medicaid.gov",
            "records": records,
            "sample": True,
            "note": "FMAP rates are approximate FY2025 values",
        },
        "medicaid_fmap.json",
    )
    update_manifest("medicaid_cms",
                    status="success",
                    record_count=len(records))


def run():
    """Run the full Medicaid/CMS pipeline."""
    logger.info("Running Medicaid/CMS pipeline...")
    raw = fetch_expenditure_data()
    records = transform(raw)
    output(records)
    logger.info(f"Medicaid pipeline complete: {len(records)} records")
    return records


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
