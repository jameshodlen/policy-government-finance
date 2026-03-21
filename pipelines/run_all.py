"""
Pipeline Orchestrator
Runs all Tier 1 API pipelines in sequence, logs results, writes manifest.
"""

import sys
import logging
import traceback
from datetime import datetime

from pipelines.utils import write_site_json
from pipelines.config import SITE_DATA

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("pipeline.orchestrator")


PIPELINES = [
    ("Census Gov Finances", "pipelines.census"),
    ("USASpending", "pipelines.usaspending"),
    ("BEA Regional", "pipelines.bea"),
    ("FRED", "pipelines.fred"),
    ("Medicaid/CMS", "pipelines.medicaid_cms"),
    ("Treasury Fiscal", "pipelines.treasury"),
]


def run_all():
    """Run all pipelines and report results."""
    results = []
    start = datetime.utcnow()

    logger.info("=" * 60)
    logger.info("Starting pipeline orchestration")
    logger.info("=" * 60)

    for name, module_path in PIPELINES:
        logger.info(f"\n--- {name} ---")
        try:
            module = __import__(module_path, fromlist=["run"])
            records = module.run()
            count = len(records) if records else 0
            results.append({"name": name, "status": "success", "records": count})
            logger.info(f"{name}: SUCCESS ({count} records)")
        except Exception as e:
            results.append({"name": name, "status": "error", "error": str(e)})
            logger.error(f"{name}: ERROR - {e}")
            traceback.print_exc()

    elapsed = (datetime.utcnow() - start).total_seconds()

    logger.info("\n" + "=" * 60)
    logger.info("Pipeline Summary")
    logger.info("=" * 60)
    for r in results:
        status = r["status"].upper()
        detail = f"{r.get('records', 0)} records" if r["status"] == "success" else r.get("error", "")
        logger.info(f"  {r['name']}: {status} — {detail}")
    logger.info(f"Total time: {elapsed:.1f}s")

    return results


if __name__ == "__main__":
    run_all()
