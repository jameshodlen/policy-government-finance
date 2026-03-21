"""
Census Bureau Annual Survey of State & Local Government Finances
Endpoint: api.census.gov
Data: Revenue by source, expenditure by function, debt outstanding — all 50 states
Auth: API key (free, register at census.gov)
Update: Annual | Lag: 18-24 months
"""

import logging
import requests

from pipelines.config import CENSUS_API_KEY, STATE_FIPS, STATE_NAMES, SITE_DATA
from pipelines.utils import (
    RateLimiter, load_cached, save_cache, write_site_json,
    validate_state_coverage, update_manifest, per_capita,
)

logger = logging.getLogger("pipeline.census")

BASE_URL = "https://api.census.gov/data"

# Census Annual Survey table codes for state government finances
# See: https://www.census.gov/programs-surveys/gov-finances.html
REVENUE_VARIABLES = {
    "GENERAL_REVENUE": "Total general revenue",
    "TAX_REVENUE": "Total tax revenue",
    "INCOME_TAX": "Individual income tax",
    "SALES_TAX": "General sales and gross receipts tax",
    "PROPERTY_TAX": "Property tax",
    "INTERGOVERNMENTAL": "Intergovernmental revenue",
}

EXPENDITURE_VARIABLES = {
    "GENERAL_EXPENDITURE": "Total general expenditure",
    "EDUCATION": "Education",
    "PUBLIC_WELFARE": "Public welfare (includes Medicaid)",
    "HOSPITALS": "Hospitals",
    "HIGHWAYS": "Highways",
    "POLICE_CORRECTION": "Police protection and corrections",
}

DEBT_VARIABLES = {
    "TOTAL_DEBT": "Total debt outstanding",
    "LONG_TERM_DEBT": "Long-term debt outstanding",
}

rate_limiter = RateLimiter(requests_per_second=2)


def fetch_gov_finances(year=2022):
    """
    Fetch state government finance data from Census API.
    Returns raw API response or None on failure.
    """
    if not CENSUS_API_KEY:
        logger.warning("No CENSUS_API_KEY set. Skipping live fetch.")
        return None

    cache_key = f"gov_finances_{year}"
    cached = load_cached("census", cache_key, max_age_hours=168)
    if cached:
        logger.info(f"Using cached Census data for {year}")
        return cached

    # The Annual Survey endpoint structure
    endpoint = f"{BASE_URL}/{year}/govs"
    params = {
        "get": "AMOUNT,NAME",
        "for": "state:*",
        "key": CENSUS_API_KEY,
    }

    try:
        rate_limiter.wait()
        logger.info(f"Fetching Census gov finances for FY{year}...")
        resp = requests.get(endpoint, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        save_cache("census", cache_key, data)
        return data
    except requests.RequestException as e:
        logger.error(f"Census API error: {e}")
        return None


def transform(raw_data):
    """
    Transform raw Census API response into normalized state records.
    """
    if not raw_data:
        return []

    records = []
    # Census API returns list of lists; first row is headers
    headers = raw_data[0]
    for row in raw_data[1:]:
        record = dict(zip(headers, row))
        records.append(record)

    return records


def output(records, year=2022):
    """Write processed Census data to site JSON."""
    write_site_json(
        {
            "source": "Census Bureau Annual Survey of State Government Finances",
            "year": year,
            "records": records,
            "sample": len(records) == 0,
        },
        "census_gov_finances.json",
    )
    update_manifest("census_gov_finances",
                    status="success" if records else "no_api_key",
                    record_count=len(records))


def run(year=2022):
    """Run the full Census pipeline."""
    logger.info("Running Census Gov Finances pipeline...")
    raw = fetch_gov_finances(year)
    records = transform(raw)
    output(records, year)
    logger.info(f"Census pipeline complete: {len(records)} records")
    return records


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
