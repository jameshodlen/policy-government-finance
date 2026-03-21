"""
Treasury Fiscal Data
Endpoint: api.fiscaldata.treasury.gov (open, no auth)
Data: Monthly Treasury Statements, grant-to-state totals by function
Update: Daily/Monthly | Lag: Days
"""

import logging
import requests

from pipelines.utils import (
    RateLimiter, load_cached, save_cache, write_site_json,
    update_manifest,
)

logger = logging.getLogger("pipeline.treasury")

BASE_URL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"
rate_limiter = RateLimiter(requests_per_second=3)

# Key Treasury endpoints
ENDPOINTS = {
    "mts_receipts": "/v1/accounting/mts/mts_table_4",
    "mts_outlays": "/v1/accounting/mts/mts_table_5",
    "debt": "/v2/accounting/od/debt_to_penny",
}


def fetch_endpoint(name, params=None):
    """Fetch data from a Treasury Fiscal Data endpoint."""
    cache_key = f"treasury_{name}"
    cached = load_cached("treasury", cache_key, max_age_hours=24)
    if cached:
        return cached

    endpoint = ENDPOINTS.get(name)
    if not endpoint:
        logger.error(f"Unknown Treasury endpoint: {name}")
        return None

    default_params = {
        "sort": "-record_date",
        "page[size]": 100,
        "format": "json",
    }
    if params:
        default_params.update(params)

    try:
        rate_limiter.wait()
        logger.info(f"Fetching Treasury {name}...")
        resp = requests.get(f"{BASE_URL}{endpoint}", params=default_params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        save_cache("treasury", cache_key, data)
        return data
    except requests.RequestException as e:
        logger.error(f"Treasury API error for {name}: {e}")
        return None


def transform(receipts_data, outlays_data, debt_data):
    """Transform raw Treasury responses."""
    records = {
        "receipts": [],
        "outlays": [],
        "debt": [],
    }

    if receipts_data and "data" in receipts_data:
        for row in receipts_data["data"][:12]:
            records["receipts"].append({
                "date": row.get("record_date"),
                "category": row.get("classification_desc"),
                "amount": row.get("current_fytd_net_rcpt_amt"),
            })

    if debt_data and "data" in debt_data:
        for row in debt_data["data"][:30]:
            records["debt"].append({
                "date": row.get("record_date"),
                "totalDebt": row.get("tot_pub_debt_out_amt"),
            })

    return records


def output(records):
    """Write processed Treasury data."""
    write_site_json(
        {
            "source": "Treasury Fiscal Data (fiscaldata.treasury.gov)",
            "records": records,
            "sample": all(len(v) == 0 for v in records.values()),
        },
        "treasury_fiscal.json",
    )
    update_manifest("treasury_fiscal",
                    status="success",
                    record_count=sum(len(v) for v in records.values()))


def run():
    """Run the full Treasury pipeline."""
    logger.info("Running Treasury Fiscal Data pipeline...")
    receipts = fetch_endpoint("mts_receipts")
    outlays = fetch_endpoint("mts_outlays")
    debt = fetch_endpoint("debt")
    records = transform(receipts, outlays, debt)
    output(records)
    logger.info("Treasury pipeline complete")
    return records


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
