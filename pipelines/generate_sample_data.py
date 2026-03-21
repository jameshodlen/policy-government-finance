"""
Generate realistic sample data for all 50 states.
This allows the site to render with plausible data before live API pipelines
are connected. All values are clearly flagged as sample data.

Sources for calibrating sample ranges:
- Census Annual Survey of State Government Finances (FY2022)
- BEA GDP by State (2023)
- PPD Public Plans Database (FY2023)
- Pew Fiscal 50 (FY2024)
- NASBO State Expenditure Report (FY2023)
"""

import json
import random
import math
from datetime import datetime
from pathlib import Path

# Ensure reproducible sample data
random.seed(42)

SITE_DATA = Path(__file__).parent.parent / "site" / "data"

# --- State baseline data (calibrated to real ranges) ---
# Format: (abbrev, name, fips, population_approx, gdp_approx_billions)
STATES = [
    ("AL", "Alabama", "01", 5074296, 271),
    ("AK", "Alaska", "02", 733583, 60),
    ("AZ", "Arizona", "04", 7359197, 430),
    ("AR", "Arkansas", "05", 3045637, 152),
    ("CA", "California", "06", 39029342, 3899),
    ("CO", "Colorado", "08", 5839926, 453),
    ("CT", "Connecticut", "09", 3626205, 310),
    ("DE", "Delaware", "10", 1018396, 82),
    ("FL", "Florida", "12", 22244823, 1389),
    ("GA", "Georgia", "13", 10912876, 729),
    ("HI", "Hawaii", "15", 1440196, 94),
    ("ID", "Idaho", "16", 1939033, 104),
    ("IL", "Illinois", "17", 12582032, 1004),
    ("IN", "Indiana", "18", 6833037, 429),
    ("IA", "Iowa", "19", 3200517, 213),
    ("KS", "Kansas", "20", 2937150, 190),
    ("KY", "Kentucky", "21", 4512310, 233),
    ("LA", "Louisiana", "22", 4590241, 269),
    ("ME", "Maine", "23", 1385340, 78),
    ("MD", "Maryland", "24", 6164660, 453),
    ("MA", "Massachusetts", "25", 6981974, 669),
    ("MI", "Michigan", "26", 10037261, 586),
    ("MN", "Minnesota", "27", 5717184, 418),
    ("MS", "Mississippi", "28", 2940057, 127),
    ("MO", "Missouri", "29", 6177957, 365),
    ("MT", "Montana", "30", 1122867, 62),
    ("NE", "Nebraska", "31", 1967923, 147),
    ("NV", "Nevada", "32", 3177772, 204),
    ("NH", "New Hampshire", "33", 1395231, 103),
    ("NJ", "New Jersey", "34", 9261699, 714),
    ("NM", "New Mexico", "35", 2113344, 113),
    ("NY", "New York", "36", 19677151, 2053),
    ("NC", "North Carolina", "37", 10698973, 672),
    ("ND", "North Dakota", "38", 779261, 63),
    ("OH", "Ohio", "39", 11756058, 740),
    ("OK", "Oklahoma", "40", 4019800, 214),
    ("OR", "Oregon", "41", 4240137, 274),
    ("PA", "Pennsylvania", "42", 12972008, 882),
    ("RI", "Rhode Island", "44", 1093734, 67),
    ("SC", "South Carolina", "45", 5282634, 277),
    ("SD", "South Dakota", "46", 909824, 66),
    ("TN", "Tennessee", "47", 7051339, 441),
    ("TX", "Texas", "48", 30029572, 2146),
    ("UT", "Utah", "49", 3380800, 228),
    ("VT", "Vermont", "50", 647064, 37),
    ("VA", "Virginia", "51", 8642274, 622),
    ("WA", "Washington", "53", 7785786, 695),
    ("WV", "West Virginia", "54", 1775156, 84),
    ("WI", "Wisconsin", "55", 5892539, 374),
    ("WY", "Wyoming", "56", 576851, 42),
]

# States with no income tax
NO_INCOME_TAX = {"AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY"}

# Medicaid expansion states (40 + DC as of 2025)
NON_EXPANSION = {"AL", "FL", "GA", "KS", "MS", "SC", "TN", "TX", "WI", "WY"}

# Credit ratings (approximate, calibrated to real data)
CREDIT_RATINGS = {
    "GA": "AAA", "IA": "AAA", "IN": "AAA", "MD": "AAA", "MO": "AAA",
    "NC": "AAA", "TN": "AAA", "TX": "AAA", "UT": "AAA", "VA": "AAA",
    "DE": "AAA", "FL": "AAA", "MN": "AAA", "NE": "AAA", "SD": "AAA",
    "VT": "AAA", "WA": "AAA", "WY": "AAA",
    "AL": "AA+", "AZ": "AA+", "AR": "AA+", "CO": "AA+", "ID": "AA+",
    "KS": "AA+", "MA": "AA+", "MI": "AA+", "MT": "AA+", "NH": "AA+",
    "NM": "AA+", "NY": "AA+", "ND": "AA+", "OH": "AA+", "OK": "AA+",
    "OR": "AA+", "SC": "AA+", "WI": "AA+",
    "CA": "AA-", "HI": "AA-", "KY": "AA-", "LA": "AA-", "ME": "AA-",
    "MS": "AA-", "NV": "AA-", "PA": "AA-", "RI": "AA-", "WV": "AA-",
    "CT": "A+", "NJ": "A+",
    "IL": "BBB+",
    "AK": "AA",
}

# Pension funded ratios (calibrated to PPD FY2023 data)
PENSION_FUNDED = {
    "WI": 102.5, "SD": 100.1, "NE": 93.2, "TN": 92.8, "NY": 90.4,
    "WA": 88.7, "NC": 87.3, "IA": 86.9, "DE": 86.5, "ID": 85.8,
    "UT": 85.2, "OR": 84.1, "MN": 83.6, "GA": 82.4, "FL": 81.3,
    "OH": 80.7, "ME": 79.8, "VA": 79.2, "TX": 78.5, "AR": 77.9,
    "IN": 77.4, "MO": 76.8, "MD": 76.1, "MI": 75.3, "WV": 74.8,
    "AZ": 74.2, "OK": 73.6, "VT": 72.9, "KS": 72.3, "MT": 71.8,
    "NM": 71.2, "AL": 70.5, "CA": 69.8, "ND": 69.3, "NH": 68.7,
    "RI": 68.1, "MA": 67.4, "PA": 66.8, "WY": 66.2, "CO": 65.5,
    "NV": 64.9, "LA": 64.3, "HI": 63.2, "MS": 62.1, "AK": 61.4,
    "SC": 60.8, "CT": 52.3, "KY": 49.8, "NJ": 44.7, "IL": 40.1,
}

# Pew revenue volatility index (calibrated to real data)
VOLATILITY = {
    "AK": 83.7, "ND": 62.4, "WY": 58.1, "NM": 42.3, "WV": 38.5,
    "OK": 35.2, "MT": 28.4, "LA": 27.1, "CT": 24.8, "NV": 23.5,
    "CA": 22.1, "NY": 19.8, "TX": 18.4, "CO": 17.2, "OR": 16.8,
    "MA": 16.1, "WA": 15.4, "HI": 14.8, "NJ": 14.2, "ID": 13.5,
    "AZ": 13.1, "UT": 12.8, "NH": 12.4, "FL": 12.1, "GA": 11.7,
    "SC": 11.3, "NC": 10.9, "IL": 10.6, "PA": 10.2, "MN": 9.8,
    "MI": 9.5, "VA": 9.2, "TN": 8.9, "MD": 8.6, "IN": 8.3,
    "OH": 8.0, "WI": 7.7, "MO": 7.4, "KS": 7.1, "KY": 6.8,
    "MS": 6.5, "AL": 6.2, "IA": 5.9, "NE": 5.6, "ME": 5.3,
    "RI": 5.0, "VT": 4.8, "SD": 4.5, "DE": 4.3, "AR": 4.0,
}

# Reserve days (Pew data, calibrated)
RESERVE_DAYS = {
    "WY": 320, "AK": 185, "ND": 142, "WV": 98, "NM": 87,
    "ID": 75, "TX": 68, "IN": 62, "NE": 58, "IA": 55,
    "TN": 52, "FL": 48, "GA": 45, "MN": 43, "UT": 41,
    "SD": 39, "OK": 37, "MT": 35, "VA": 33, "NC": 31,
    "WI": 30, "OH": 28, "MO": 27, "SC": 26, "AR": 25,
    "KS": 24, "MI": 23, "OR": 22, "WA": 21, "CO": 20,
    "AL": 19, "KY": 18, "MD": 17, "AZ": 16, "CA": 15,
    "NH": 14, "LA": 13, "DE": 12, "ME": 11, "MA": 10,
    "HI": 9, "NV": 8, "RI": 7, "MS": 6, "NY": 5,
    "VT": 4, "CT": 3, "WV": 2, "PA": 8, "IL": 2,
    "NM": 87, "NJ": 0,
}


def generate_state_summary(abbrev, name, fips, pop, gdp):
    """Generate a summary record for one state."""
    # Revenue (calibrated: US average ~$8K per capita total state revenue)
    base_rev = pop * random.uniform(6500, 11000)

    # Draw raw component weights, then normalize to sum to base_rev
    # This prevents negative otherRevenue from percentage overflows
    raw_income = 0 if abbrev in NO_INCOME_TAX else random.uniform(0.25, 0.40)
    raw_sales = random.uniform(0.20, 0.35)
    raw_property = random.uniform(0.01, 0.05)
    raw_federal = random.uniform(0.25, 0.40)
    raw_other = random.uniform(0.05, 0.15)

    total_weight = raw_income + raw_sales + raw_property + raw_federal + raw_other
    income_tax = base_rev * (raw_income / total_weight)
    sales_tax = base_rev * (raw_sales / total_weight)
    property_tax = base_rev * (raw_property / total_weight)
    federal_transfers = base_rev * (raw_federal / total_weight)
    other_rev = base_rev * (raw_other / total_weight)

    # Expenditure
    total_exp = base_rev * random.uniform(0.95, 1.05)
    education = total_exp * random.uniform(0.25, 0.35)
    medicaid = total_exp * random.uniform(0.20, 0.30)
    transportation = total_exp * random.uniform(0.06, 0.12)
    corrections = total_exp * random.uniform(0.03, 0.06)
    other_exp = total_exp - education - medicaid - transportation - corrections

    # Debt
    debt = pop * random.uniform(2000, 8000)
    if abbrev in ("NY", "CA", "CT", "NJ", "MA", "IL"):
        debt = pop * random.uniform(6000, 12000)

    # Pension
    funded_ratio = PENSION_FUNDED.get(abbrev, 75.0)
    unfunded_liability = (pop * random.uniform(9000, 20000)) * (1 - funded_ratio / 100)
    if funded_ratio < 50:
        unfunded_liability *= 1.5
    annual_contribution = unfunded_liability * random.uniform(0.04, 0.08)

    # Federal dependency
    fed_dependency = (federal_transfers / base_rev) * 100

    return {
        "abbrev": abbrev,
        "name": name,
        "fips": fips,
        "population": pop,
        "gdp": gdp * 1e9,
        "gdpPerCapita": round(gdp * 1e9 / pop),
        "personalIncome": round(gdp * 1e9 * random.uniform(0.68, 0.82)),
        "personalIncomePerCapita": round(gdp * 1e9 * random.uniform(0.68, 0.82) / pop),

        # Revenue
        "totalRevenue": round(base_rev),
        "revenuePerCapita": round(base_rev / pop),
        "incomeTaxRevenue": round(income_tax),
        "salesTaxRevenue": round(sales_tax),
        "propertyTaxRevenue": round(property_tax),
        "federalTransfers": round(federal_transfers),
        "otherRevenue": round(other_rev),

        # Expenditure
        "totalExpenditure": round(total_exp),
        "expenditurePerCapita": round(total_exp / pop),
        "educationSpending": round(education),
        "medicaidSpending": round(medicaid),
        "transportationSpending": round(transportation),
        "correctionsSpending": round(corrections),
        "otherExpenditure": round(other_exp),

        # Debt
        "totalDebt": round(debt),
        "debtPerCapita": round(debt / pop),
        "debtAsPercentGDP": round((debt / (gdp * 1e9)) * 100, 1),
        "creditRating": CREDIT_RATINGS.get(abbrev, "AA"),

        # Pensions
        "pensionFundedRatio": funded_ratio,
        "unfundedLiability": round(unfunded_liability),
        "annualPensionContribution": round(annual_contribution),
        "pensionContributionAsPercentRevenue": round((annual_contribution / base_rev) * 100, 1),

        # Reserves
        "reserveDays": RESERVE_DAYS.get(abbrev, 20),

        # Volatility
        "revenueVolatility": VOLATILITY.get(abbrev, 10.0),

        # Federal dependency
        "federalDependencyRatio": round(fed_dependency, 1),

        # Medicaid
        "medicaidExpanded": abbrev not in NON_EXPANSION,
        "medicaidWaiverCoverage": abbrev == "WI",

        # Flags
        "hasIncomeTax": abbrev not in NO_INCOME_TAX,
        "biennialBudget": abbrev in ["CT", "HI", "IN", "KY", "ME", "MN", "MT",
                                      "NE", "NH", "NC", "ND", "OH", "OR", "TX",
                                      "VA", "WA", "WI", "WV", "WY"],
    }


def generate_historical_trend(base_value, years=10, growth_rate=0.03, volatility=0.02):
    """Generate a plausible 10-year trend."""
    points = []
    value = base_value / ((1 + growth_rate) ** years)
    for i in range(years):
        year = 2015 + i
        noise = random.gauss(0, volatility)
        value *= (1 + growth_rate + noise)
        points.append({"year": year, "value": round(value)})
    return points


def generate_state_profile(state):
    """Generate a detailed profile for one state."""
    return {
        **state,
        "fiscalYear": "July 1 - June 30" if state["abbrev"] not in ("NY", "TX", "AL", "MI") else
                      {"NY": "April 1 - March 31", "TX": "September 1 - August 31",
                       "AL": "October 1 - September 30", "MI": "October 1 - September 30"}
                      .get(state["abbrev"]),
        "revenueTrend": generate_historical_trend(state["totalRevenue"]),
        "expenditureTrend": generate_historical_trend(state["totalExpenditure"], growth_rate=0.035),
        "revenueBreakdown": [
            {"category": "Income Tax", "value": state["incomeTaxRevenue"],
             "color": "#2c5f8a"},
            {"category": "Sales Tax", "value": state["salesTaxRevenue"],
             "color": "#4a90b8"},
            {"category": "Federal Transfers", "value": state["federalTransfers"],
             "color": "#7ab8d4"},
            {"category": "Property Tax", "value": state["propertyTaxRevenue"],
             "color": "#a8d4e6"},
            {"category": "Other", "value": state["otherRevenue"],
             "color": "#d4ecf4"},
        ],
        "expenditureBreakdown": [
            {"category": "Education", "value": state["educationSpending"],
             "color": "#2c5f8a"},
            {"category": "Medicaid", "value": state["medicaidSpending"],
             "color": "#4a90b8"},
            {"category": "Transportation", "value": state["transportationSpending"],
             "color": "#7ab8d4"},
            {"category": "Corrections", "value": state["correctionsSpending"],
             "color": "#a8d4e6"},
            {"category": "Other", "value": state["otherExpenditure"],
             "color": "#d4ecf4"},
        ],
        "pensionHistory": generate_historical_trend(
            state["annualPensionContribution"], growth_rate=0.05),
        "fundedRatioHistory": [
            {"year": 2015 + i,
             "value": round(state["pensionFundedRatio"] - (10 - i) * random.uniform(0.5, 1.5), 1)}
            for i in range(10)
        ],
    }


def generate_pension_overview(states):
    """Generate 50-state pension comparison data."""
    return {
        "lastUpdated": "2024-06-30",
        "source": "Public Plans Database (Boston College CRR)",
        "sample": True,
        "nationalFundedRatio": 77.4,
        "totalUnfundedLiability": sum(s["unfundedLiability"] for s in states),
        "states": [
            {
                "abbrev": s["abbrev"],
                "name": s["name"],
                "fundedRatio": s["pensionFundedRatio"],
                "unfundedLiability": s["unfundedLiability"],
                "annualContribution": s["annualPensionContribution"],
                "contributionAsPercentRevenue": s["pensionContributionAsPercentRevenue"],
                "unfundedAsPercentRevenue": round(
                    (s["unfundedLiability"] / s["totalRevenue"]) * 100, 1)
                    if s["totalRevenue"] > 0 else 0,
                "highlight": s["abbrev"] in ("WI", "MN", "IL", "NJ", "CT", "KY"),
            }
            for s in sorted(states, key=lambda x: x["pensionFundedRatio"], reverse=True)
        ],
    }


def generate_manifest():
    """Generate data freshness manifest."""
    now = datetime.utcnow().isoformat() + "Z"
    return {
        "sample": True,
        "generated": now,
        "last_run": now,
        "note": "Sample data for development. Connect live API pipelines for real data.",
        "sources": {
            "census_gov_finances": {
                "last_updated": now,
                "status": "sample",
                "description": "Census Annual Survey of State & Local Government Finances",
                "record_count": 50,
                "data_year": "FY2022 (sample)",
            },
            "usaspending": {
                "last_updated": now,
                "status": "sample",
                "description": "Federal spending to states",
                "record_count": 50,
                "data_year": "FY2024 (sample)",
            },
            "bea_regional": {
                "last_updated": now,
                "status": "sample",
                "description": "State GDP and personal income",
                "record_count": 50,
                "data_year": "2023 (sample)",
            },
            "fred": {
                "last_updated": now,
                "status": "sample",
                "description": "Economic time series",
                "record_count": 0,
                "data_year": "N/A (sample)",
            },
            "medicaid_cms": {
                "last_updated": now,
                "status": "sample",
                "description": "Medicaid expenditure by state",
                "record_count": 50,
                "data_year": "FY2023 (sample)",
            },
            "treasury_fiscal": {
                "last_updated": now,
                "status": "sample",
                "description": "Federal fiscal data",
                "record_count": 0,
                "data_year": "N/A (sample)",
            },
            "ppd_pensions": {
                "last_updated": now,
                "status": "sample",
                "description": "Public pension plan data",
                "record_count": 50,
                "data_year": "FY2023 (sample)",
            },
            "pew_reserves": {
                "last_updated": now,
                "status": "sample",
                "description": "Rainy day fund balances",
                "record_count": 50,
                "data_year": "FY2024 (sample)",
            },
        },
    }


def main():
    """Generate all sample data files."""
    print("Generating sample data for 50-State Finance Platform...")

    # Generate state summaries
    states = []
    for abbrev, name, fips, pop, gdp in STATES:
        s = generate_state_summary(abbrev, name, fips, pop, gdp)
        states.append(s)

    # 50-state summary
    summary_path = SITE_DATA / "states-summary.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with open(summary_path, "w") as f:
        json.dump({
            "sample": True,
            "generated": datetime.utcnow().isoformat() + "Z",
            "states": states,
        }, f, indent=2)
    print(f"  Wrote {summary_path}")

    # State profiles for WI and MN
    for abbrev in ("wi", "mn"):
        state = next(s for s in states if s["abbrev"] == abbrev.upper())
        profile = generate_state_profile(state)
        profile_dir = SITE_DATA / abbrev
        profile_dir.mkdir(parents=True, exist_ok=True)
        profile_path = profile_dir / "profile.json"
        with open(profile_path, "w") as f:
            json.dump({"sample": True, **profile}, f, indent=2)
        print(f"  Wrote {profile_path}")

    # Pension overview
    pension_data = generate_pension_overview(states)
    pension_dir = SITE_DATA / "pensions"
    pension_dir.mkdir(parents=True, exist_ok=True)
    pension_path = pension_dir / "overview.json"
    with open(pension_path, "w") as f:
        json.dump(pension_data, f, indent=2)
    print(f"  Wrote {pension_path}")

    # Manifest
    manifest = generate_manifest()
    manifest_path = SITE_DATA / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"  Wrote {manifest_path}")

    print("Done! Sample data generated for 50 states.")


if __name__ == "__main__":
    main()
