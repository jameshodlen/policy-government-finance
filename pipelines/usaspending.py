"""
USASpending.gov — Federal spending to states
Endpoint: api.usaspending.gov (no auth required)
Data: Grants, contracts, loans, direct payments by state
Update: Quarterly | Lag: Near real-time
"""

import logging
import requests

from pipelines.config import STATE_FIPS, STATE_NAMES, SITE_DATA
from pipelines.utils import (
    RateLimiter, load_cached, save_cache, write_site_json,
    update_manifest, per_capita, as_percent_of,
)

logger = logging.getLogger("pipeline.usaspending")

BASE_URL = "https://api.usaspending.gov/api/v2"
rate_limiter = RateLimiter(requests_per_second=3)


def fetch_state_spending(fips_code, fiscal_year=2024):
    """Fetch federal spending summary for one state."""
    cache_key = f"state_{fips_code}_{fiscal_year}"
    cached = load_cached("usaspending", cache_key, max_age_hours=168)
    if cached:
        return cached

    endpoint = f"{BASE_URL}/recipient/state/{fips_code}/"
    params = {"year": fiscal_year}

    try:
        rate_limiter.wait()
        resp = requests.get(endpoint, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        save_cache("usaspending", cache_key, data)
        return data
    except requests.RequestException as e:
        logger.error(f"USASpending API error for FIPS {fips_code}: {e}")
        return None


def fetch_all_states(fiscal_year=2024):
    """Fetch spending for all 50 states."""
    results = []
    for abbrev, fips in STATE_FIPS.items():
        logger.info(f"Fetching USASpending for {abbrev}...")
        data = fetch_state_spending(fips, fiscal_year)
        if data:
            data["abbrev"] = abbrev
            data["fips"] = fips
            results.append(data)
    return results


def transform(raw_data):
    """Transform raw USASpending responses into normalized records."""
    records = []
    for state_data in raw_data:
        # USASpending /recipient/state/ returns total_amount and
        # award_amount_by_type with keys like "grants", "contracts", etc.
        award_types = state_data.get("award_amount_by_type", {})
        records.append({
            "abbrev": state_data.get("abbrev"),
            "fips": state_data.get("fips"),
            "name": state_data.get("name", STATE_NAMES.get(state_data.get("abbrev", ""))),
            "totalFederalSpending": state_data.get("total_amount", state_data.get("total", 0)),
            "grants": award_types.get("grants", state_data.get("grants", 0)),
            "contracts": award_types.get("contracts", state_data.get("contracts", 0)),
            "loans": award_types.get("loans", state_data.get("loans", 0)),
            "directPayments": award_types.get("direct_payments", state_data.get("direct_payments", 0)),
            "population": state_data.get("population", 0),
        })
    return records


def output(records, fiscal_year=2024):
    """Write processed USASpending data."""
    write_site_json(
        {
            "source": "USASpending.gov",
            "fiscalYear": fiscal_year,
            "records": records,
            "sample": len(records) == 0,
        },
        "usaspending_federal_flows.json",
    )
    update_manifest("usaspending",
                    status="success" if records else "api_error",
                    record_count=len(records))


def run(fiscal_year=2024):
    """Run the full USASpending pipeline."""
    logger.info("Running USASpending pipeline...")
    raw = fetch_all_states(fiscal_year)
    records = transform(raw)
    output(records, fiscal_year)
    logger.info(f"USASpending pipeline complete: {len(records)} records")
    return records


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
