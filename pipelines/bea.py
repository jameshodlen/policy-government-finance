"""
Bureau of Economic Analysis (BEA) Regional
Endpoint: apps.bea.gov/api/ (free API key)
Data: State GDP, personal income, per capita income, regional price parities
Update: Quarterly | Lag: ~3 months
"""

import logging
import requests

from pipelines.config import BEA_API_KEY, STATE_FIPS, STATE_NAMES
from pipelines.utils import (
    RateLimiter, load_cached, save_cache, write_site_json,
    update_manifest,
)

logger = logging.getLogger("pipeline.bea")

BASE_URL = "https://apps.bea.gov/api/data"
rate_limiter = RateLimiter(requests_per_second=2)


def fetch_table(table_name, year="LAST5"):
    """Fetch a BEA regional data table."""
    if not BEA_API_KEY:
        logger.warning("No BEA_API_KEY set. Skipping live fetch.")
        return None

    cache_key = f"{table_name}_{year}"
    cached = load_cached("bea", cache_key, max_age_hours=168)
    if cached:
        return cached

    params = {
        "UserID": BEA_API_KEY,
        "method": "GetData",
        "datasetname": "Regional",
        "TableName": table_name,
        "LineCode": "1",
        "GeoFips": "STATE",
        "Year": year,
        "ResultFormat": "JSON",
    }

    try:
        rate_limiter.wait()
        logger.info(f"Fetching BEA table {table_name}...")
        resp = requests.get(BASE_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        save_cache("bea", cache_key, data)
        return data
    except requests.RequestException as e:
        logger.error(f"BEA API error: {e}")
        return None


def fetch_state_gdp(year="LAST5"):
    """Fetch GDP by state (SAGDP table)."""
    return fetch_table("SAGDP2N", year)


def fetch_personal_income(year="LAST5"):
    """Fetch personal income by state."""
    return fetch_table("SAINC1", year)


def fetch_price_parities(year="LAST5"):
    """Fetch regional price parities."""
    return fetch_table("SARPP", year)


def transform(gdp_data, income_data, price_data):
    """Transform raw BEA responses into state economic context records."""
    records = []
    # Process raw BEA JSON structure
    if not gdp_data:
        return records

    try:
        bea_results = gdp_data.get("BEAAPI", {}).get("Results", {}).get("Data", [])
        for row in bea_results:
            fips = row.get("GeoFips", "")[:2]
            if fips in {v for v in STATE_FIPS.values()}:
                records.append({
                    "fips": fips,
                    "year": row.get("TimePeriod"),
                    "gdp": float(row.get("DataValue", "0").replace(",", "")),
                    "name": row.get("GeoName"),
                })
    except (KeyError, ValueError) as e:
        logger.error(f"BEA transform error: {e}")

    return records


def output(records):
    """Write processed BEA data."""
    write_site_json(
        {
            "source": "Bureau of Economic Analysis",
            "records": records,
            "sample": len(records) == 0,
        },
        "bea_economic_context.json",
    )
    update_manifest("bea_regional",
                    status="success" if records else ("no_api_key" if not BEA_API_KEY else "api_error"),
                    record_count=len(records))


def run():
    """Run the full BEA pipeline."""
    logger.info("Running BEA Regional pipeline...")
    gdp = fetch_state_gdp()
    income = fetch_personal_income()
    prices = fetch_price_parities()
    records = transform(gdp, income, prices)
    output(records)
    logger.info(f"BEA pipeline complete: {len(records)} records")
    return records


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
