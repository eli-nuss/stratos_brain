#!/usr/bin/env python3
"""
Fetch top 200 global tech stocks by market cap from FMP.
This script identifies major tech companies across global exchanges.
"""

import os
import json
import requests
import time
from typing import List, Dict

FMP_API_KEY = os.environ.get("FMP_API_KEY", "DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe")
BASE_URL = "https://financialmodelingprep.com/stable"

# Known major global tech companies to start with
# We'll fetch their profiles to get market cap and verify availability
GLOBAL_TECH_SYMBOLS = [
    # US Tech Giants
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL",
    "ADBE", "CRM", "AMD", "INTC", "QCOM", "TXN", "IBM", "NOW", "INTU", "AMAT",
    "MU", "LRCX", "ADI", "KLAC", "SNPS", "CDNS", "MRVL", "NXPI", "MCHP", "ON",
    "HPQ", "HPE", "DELL", "CSCO", "PANW", "CRWD", "FTNT", "ZS", "NET", "DDOG",
    "SNOW", "PLTR", "UBER", "ABNB", "SQ", "PYPL", "COIN", "SHOP", "WDAY", "TEAM",
    "SPLK", "OKTA", "ZM", "DOCU", "TWLO", "ROKU", "TTD", "PINS", "SNAP", "RBLX",
    
    # Japan Tech (.T suffix)
    "6758.T",   # Sony Group
    "7974.T",   # Nintendo
    "9984.T",   # SoftBank Group
    "6861.T",   # Keyence
    "6501.T",   # Hitachi
    "6902.T",   # Denso
    "6762.T",   # TDK
    "4063.T",   # Shin-Etsu Chemical
    "6857.T",   # Advantest
    "8035.T",   # Tokyo Electron
    "6971.T",   # Kyocera
    "6503.T",   # Mitsubishi Electric
    "6752.T",   # Panasonic
    "7751.T",   # Canon
    "4543.T",   # Terumo
    "6594.T",   # Nidec
    "3350.T",   # Metaplanet (user requested)
    
    # Hong Kong/China Tech (.HK suffix)
    "0700.HK",  # Tencent Holdings
    "9988.HK",  # Alibaba Group
    "9618.HK",  # JD.com
    "3690.HK",  # Meituan
    "9999.HK",  # NetEase
    "1810.HK",  # Xiaomi
    "0981.HK",  # SMIC
    "2382.HK",  # Sunny Optical
    "0285.HK",  # BYD Electronic
    "0992.HK",  # Lenovo
    "1024.HK",  # Kuaishou
    "9888.HK",  # Baidu
    "2018.HK",  # AAC Technologies
    
    # Taiwan Tech (.TW suffix)
    "2330.TW",  # TSMC
    "2454.TW",  # MediaTek
    "2317.TW",  # Hon Hai (Foxconn)
    "2308.TW",  # Delta Electronics
    "3711.TW",  # ASE Technology
    "2303.TW",  # United Microelectronics
    "2412.TW",  # Chunghwa Telecom
    "2382.TW",  # Quanta Computer
    "2357.TW",  # ASUS
    "2395.TW",  # Advantech
    
    # Korea Tech (.KS suffix)
    "005930.KS",  # Samsung Electronics
    "000660.KS",  # SK Hynix
    "035420.KS",  # Naver
    "035720.KS",  # Kakao
    "006400.KS",  # Samsung SDI
    "066570.KS",  # LG Electronics
    "034730.KS",  # SK Inc
    "051910.KS",  # LG Chem
    "003550.KS",  # LG Corp
    "009150.KS",  # Samsung Electro-Mechanics
    
    # Europe Tech
    "ASML",     # ASML (Netherlands, listed on NASDAQ)
    "SAP",      # SAP (Germany, listed on NYSE)
    "ASML.AS",  # ASML Amsterdam
    "SAP.DE",   # SAP Frankfurt
    "IFX.DE",   # Infineon
    "STM",      # STMicroelectronics
    "STM.PA",   # STMicro Paris
    "CAP.PA",   # Capgemini
    "DAST.PA",  # Dassault Systemes
    "ERIC",     # Ericsson (Sweden)
    "NOK",      # Nokia (Finland)
    "NOKIA.HE", # Nokia Helsinki
    "ARM",      # ARM Holdings
    "SPOT",     # Spotify (Sweden)
    
    # India Tech (.NS suffix)
    "TCS.NS",       # Tata Consultancy
    "INFY.NS",      # Infosys
    "WIPRO.NS",     # Wipro
    "HCLTECH.NS",   # HCL Technologies
    "TECHM.NS",     # Tech Mahindra
    "LTIM.NS",      # LTIMindtree
    
    # Other ADRs/Global
    "TSM",      # TSMC ADR
    "BABA",     # Alibaba ADR
    "JD",       # JD.com ADR
    "PDD",      # PDD Holdings
    "BIDU",     # Baidu ADR
    "NTES",     # NetEase ADR
    "TME",      # Tencent Music
    "SE",       # Sea Limited
    "GRAB",     # Grab Holdings
    "MELI",     # MercadoLibre
    "NU",       # Nu Holdings
    "GLOB",     # Globant
    
    # Additional US Tech
    "ANET", "ANSS", "KEYS", "MPWR", "SWKS", "QRVO", "CDAY", "HUBS", "VEEV",
    "MNDY", "BILL", "PCTY", "PAYC", "SMAR", "ESTC", "MDB", "PATH", "CFLT",
    "GTLB", "DOCN", "DT", "FIVN", "APPN", "APPF", "BOX", "QLYS", "TENB",
    "RPD", "CYBR", "VRNS", "SAIL", "S", "AKAM", "FFIV", "JNPR", "NTAP",
    "PSTG", "WDC", "STX", "SMCI", "IONQ", "RGTI", "QUBT"
]

def get_profile(symbol: str) -> Dict:
    """Fetch company profile from FMP."""
    url = f"{BASE_URL}/profile"
    params = {"symbol": symbol, "apikey": FMP_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return data[0]
    except Exception as e:
        print(f"Error fetching {symbol}: {e}")
    
    return None

def fetch_all_profiles() -> List[Dict]:
    """Fetch profiles for all global tech symbols."""
    profiles = []
    
    for i, symbol in enumerate(GLOBAL_TECH_SYMBOLS):
        print(f"Fetching {i+1}/{len(GLOBAL_TECH_SYMBOLS)}: {symbol}")
        profile = get_profile(symbol)
        
        if profile:
            profiles.append({
                "symbol": profile.get("symbol"),
                "name": profile.get("companyName"),
                "market_cap": profile.get("marketCap", 0),
                "currency": profile.get("currency"),
                "exchange": profile.get("exchange"),
                "exchange_full": profile.get("exchangeFullName"),
                "sector": profile.get("sector"),
                "industry": profile.get("industry"),
                "country": profile.get("country"),
                "is_etf": profile.get("isEtf", False),
                "is_adr": profile.get("isAdr", False),
                "is_actively_trading": profile.get("isActivelyTrading", True)
            })
        
        # Rate limiting - be gentle with the API
        time.sleep(0.2)
    
    return profiles

def main():
    print("Fetching global tech stock profiles from FMP...")
    profiles = fetch_all_profiles()
    
    # Filter out ETFs and inactive stocks
    active_stocks = [p for p in profiles if not p.get("is_etf") and p.get("is_actively_trading")]
    
    # Sort by market cap descending
    active_stocks.sort(key=lambda x: x.get("market_cap", 0) or 0, reverse=True)
    
    # Take top 200
    top_200 = active_stocks[:200]
    
    print(f"\nFound {len(profiles)} profiles, {len(active_stocks)} active non-ETF stocks")
    print(f"Top 200 by market cap saved to global_tech_stocks.json")
    
    # Save to file
    with open("/home/ubuntu/stratos_brain/scripts/global_tech_stocks.json", "w") as f:
        json.dump(top_200, f, indent=2)
    
    # Print summary
    print("\nTop 20 by market cap:")
    for i, stock in enumerate(top_200[:20]):
        mc = stock.get("market_cap", 0) or 0
        mc_str = f"${mc/1e12:.2f}T" if mc >= 1e12 else f"${mc/1e9:.1f}B"
        print(f"{i+1:3}. {stock['symbol']:15} {stock['name'][:40]:40} {mc_str:>10} {stock['currency']:>5}")
    
    # Currency breakdown
    currencies = {}
    for stock in top_200:
        curr = stock.get("currency", "Unknown")
        currencies[curr] = currencies.get(curr, 0) + 1
    
    print("\nCurrency breakdown:")
    for curr, count in sorted(currencies.items(), key=lambda x: -x[1]):
        print(f"  {curr}: {count}")

if __name__ == "__main__":
    main()
