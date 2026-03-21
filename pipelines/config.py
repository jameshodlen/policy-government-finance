"""
Central configuration for all data pipelines.
API endpoints, state FIPS codes, fiscal year mappings, output paths.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# --- Paths ---
PROJECT_ROOT = Path(__file__).parent.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
SITE_DATA = PROJECT_ROOT / "site" / "data"

# --- API Keys (from .env) ---
CENSUS_API_KEY = os.getenv("CENSUS_API_KEY", "")
BEA_API_KEY = os.getenv("BEA_API_KEY", "")
FRED_API_KEY = os.getenv("FRED_API_KEY", "")

# --- State FIPS Codes ---
STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06",
    "CO": "08", "CT": "09", "DE": "10", "FL": "12", "GA": "13",
    "HI": "15", "ID": "16", "IL": "17", "IN": "18", "IA": "19",
    "KS": "20", "KY": "21", "LA": "22", "ME": "23", "MD": "24",
    "MA": "25", "MI": "26", "MN": "27", "MS": "28", "MO": "29",
    "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34",
    "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39",
    "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45",
    "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50",
    "VA": "51", "WA": "53", "WV": "54", "WI": "55", "WY": "56",
}

FIPS_TO_ABBREV = {v: k for k, v in STATE_FIPS.items()}

STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}

# --- Fiscal Year Calendars ---
# Most states: July 1 - June 30
# Exceptions:
FISCAL_YEAR_EXCEPTIONS = {
    "NY": {"start_month": 4, "label": "April 1 - March 31"},
    "TX": {"start_month": 9, "label": "September 1 - August 31"},
    "AL": {"start_month": 10, "label": "October 1 - September 30"},
    "MI": {"start_month": 10, "label": "October 1 - September 30"},
}

# Biennial budget states (20 states)
BIENNIAL_BUDGET_STATES = [
    "CT", "HI", "IL", "IN", "KY", "ME", "MN", "MT", "NE", "NH",
    "NC", "ND", "OH", "OR", "TX", "VA", "WA", "WI", "WV", "WY",
]

# --- Tier 1 API Endpoints ---
TIER1_APIS = {
    "census": {
        "base_url": "https://api.census.gov/data",
        "docs": "https://www.census.gov/data/developers.html",
        "update_frequency": "Annual",
        "lag": "18-24 months",
        "description": "Annual Survey of State & Local Government Finances",
        "auth": "API key (free)",
    },
    "usaspending": {
        "base_url": "https://api.usaspending.gov/api/v2",
        "docs": "https://api.usaspending.gov",
        "update_frequency": "Quarterly",
        "lag": "Near real-time",
        "description": "Federal spending to states — grants, contracts, loans",
        "auth": "None",
    },
    "bea": {
        "base_url": "https://apps.bea.gov/api/data",
        "docs": "https://apps.bea.gov/api/signup/",
        "update_frequency": "Quarterly",
        "lag": "~3 months",
        "description": "State GDP, personal income, price parities",
        "auth": "API key (free)",
    },
    "fred": {
        "base_url": "https://api.stlouisfed.org/fred",
        "docs": "https://fred.stlouisfed.org/docs/api/fred/",
        "update_frequency": "Varies",
        "lag": "Mirrors sources",
        "description": "Unified API for economic time series",
        "auth": "API key (free)",
    },
    "medicaid": {
        "base_url": "https://data.medicaid.gov/api",
        "docs": "https://data.medicaid.gov",
        "update_frequency": "Quarterly",
        "lag": "~6 months",
        "description": "Medicaid expenditure by state, FMAP rates",
        "auth": "None",
    },
    "treasury": {
        "base_url": "https://api.fiscaldata.treasury.gov/services/api/fiscal_service",
        "docs": "https://fiscaldata.treasury.gov/api-documentation/",
        "update_frequency": "Daily/Monthly",
        "lag": "Days",
        "description": "Federal fiscal data — grants, debt, revenue",
        "auth": "None",
    },
}

# --- Tier 2 Sources (Manual/Download) ---
TIER2_SOURCES = {
    "irs_soi": {
        "url": "https://www.irs.gov/statistics",
        "update_frequency": "Annual",
        "lag": "~2 years",
        "description": "State income data + county-to-county migration",
    },
    "omb_tables": {
        "url": "https://www.whitehouse.gov/omb/budget/",
        "update_frequency": "Annual",
        "lag": "Budget release",
        "description": "Federal grants by state (Chapter 8 tables)",
    },
    "nasbo": {
        "url": "https://www.nasbo.org",
        "update_frequency": "Annual/Semi-annual",
        "lag": "Varies",
        "description": "State expenditure by function and fund source",
    },
    "ppd": {
        "url": "https://publicplansdata.org",
        "update_frequency": "Annual",
        "lag": "~1 year",
        "description": "230+ public pension plans, 100+ variables (2001-2024)",
    },
    "pew": {
        "url": "https://www.pewtrusts.org/en/projects/fiscal-50",
        "update_frequency": "Varies",
        "lag": "Varies",
        "description": "Rainy day funds, revenue volatility index",
    },
    "volcker": {
        "url": "https://volckeralliance.org",
        "update_frequency": "Periodic",
        "lag": "Varies",
        "description": "50-state budget practice grades (5 categories)",
    },
    "reason": {
        "url": "https://annual-pension-report.reason.org",
        "update_frequency": "Annual",
        "lag": "~1 year",
        "description": "Pension risk analysis and solvency projections",
    },
    "tia": {
        "url": "https://data-z.org",
        "update_frequency": "Annual",
        "lag": "Varies",
        "description": "ACFR directory, financial condition rankings",
    },
    "credit_ratings": {
        "url": "https://emma.msrb.org",
        "update_frequency": "Ongoing",
        "lag": "Days",
        "description": "S&P/Moody's/Fitch/KBRA state credit ratings",
    },
}
