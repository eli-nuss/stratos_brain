#!/usr/bin/env python3
"""
Compile list of top ETFs and global indices, verify FMP availability.
"""

import json
import time
import requests

FMP_API_KEY = "DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe"
FMP_BASE_URL = "https://financialmodelingprep.com/stable"

# Top ETFs by AUM (from ETFdb and TipRanks research)
TOP_ETFS = [
    # S&P 500 ETFs
    {"symbol": "VOO", "name": "Vanguard S&P 500 ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap", "issuer": "Vanguard"},
    {"symbol": "IVV", "name": "iShares Core S&P 500 ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap", "issuer": "iShares"},
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap", "issuer": "SPDR"},
    {"symbol": "SPLG", "name": "SPDR Portfolio S&P 500 ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap", "issuer": "SPDR"},
    
    # Total Market ETFs
    {"symbol": "VTI", "name": "Vanguard Total Stock Market ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Total Market", "issuer": "Vanguard"},
    {"symbol": "ITOT", "name": "iShares Core S&P Total U.S. Stock Market ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Total Market", "issuer": "iShares"},
    {"symbol": "SCHB", "name": "Schwab U.S. Broad Market ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Total Market", "issuer": "Schwab"},
    
    # NASDAQ/Tech ETFs
    {"symbol": "QQQ", "name": "Invesco QQQ Trust", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Growth", "issuer": "Invesco"},
    {"symbol": "QQQM", "name": "Invesco NASDAQ 100 ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Growth", "issuer": "Invesco"},
    {"symbol": "VGT", "name": "Vanguard Information Technology ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Technology", "issuer": "Vanguard"},
    {"symbol": "XLK", "name": "Technology Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Technology", "issuer": "SPDR"},
    {"symbol": "SMH", "name": "VanEck Semiconductor ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Semiconductors", "issuer": "VanEck"},
    
    # Growth ETFs
    {"symbol": "VUG", "name": "Vanguard Growth ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Growth", "issuer": "Vanguard"},
    {"symbol": "IWF", "name": "iShares Russell 1000 Growth ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Growth", "issuer": "iShares"},
    {"symbol": "SCHG", "name": "Schwab U.S. Large-Cap Growth ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Growth", "issuer": "Schwab"},
    {"symbol": "IVW", "name": "iShares S&P 500 Growth ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Growth", "issuer": "iShares"},
    {"symbol": "SPYG", "name": "SPDR Portfolio S&P 500 Growth ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Growth", "issuer": "SPDR"},
    {"symbol": "MGK", "name": "Vanguard Mega Cap Growth ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Mega Cap Growth", "issuer": "Vanguard"},
    
    # Value ETFs
    {"symbol": "VTV", "name": "Vanguard Value ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Value", "issuer": "Vanguard"},
    {"symbol": "IWD", "name": "iShares Russell 1000 Value ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Value", "issuer": "iShares"},
    {"symbol": "IVE", "name": "iShares S&P 500 Value ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Value", "issuer": "iShares"},
    {"symbol": "SPYV", "name": "SPDR Portfolio S&P 500 Value ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Value", "issuer": "SPDR"},
    {"symbol": "SCHV", "name": "Schwab U.S. Large-Cap Value ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Large Cap Value", "issuer": "Schwab"},
    
    # Dividend ETFs
    {"symbol": "VIG", "name": "Vanguard Dividend Appreciation ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Dividend Growth", "issuer": "Vanguard"},
    {"symbol": "VYM", "name": "Vanguard High Dividend Yield ETF", "asset_class": "Equity", "geography": "U.S.", "category": "High Dividend", "issuer": "Vanguard"},
    {"symbol": "SCHD", "name": "Schwab US Dividend Equity ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Dividend", "issuer": "Schwab"},
    {"symbol": "DGRO", "name": "iShares Core Dividend Growth ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Dividend Growth", "issuer": "iShares"},
    {"symbol": "DVY", "name": "iShares Select Dividend ETF", "asset_class": "Equity", "geography": "U.S.", "category": "High Dividend", "issuer": "iShares"},
    
    # Mid Cap ETFs
    {"symbol": "VO", "name": "Vanguard Mid-Cap ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Mid Cap", "issuer": "Vanguard"},
    {"symbol": "IJH", "name": "iShares Core S&P Mid-Cap ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Mid Cap", "issuer": "iShares"},
    {"symbol": "MDY", "name": "SPDR S&P Midcap 400 ETF Trust", "asset_class": "Equity", "geography": "U.S.", "category": "Mid Cap", "issuer": "SPDR"},
    {"symbol": "IWR", "name": "iShares Russell Midcap ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Mid Cap", "issuer": "iShares"},
    
    # Small Cap ETFs
    {"symbol": "VB", "name": "Vanguard Small Cap ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Small Cap", "issuer": "Vanguard"},
    {"symbol": "IJR", "name": "iShares Core S&P Small-Cap ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Small Cap", "issuer": "iShares"},
    {"symbol": "IWM", "name": "iShares Russell 2000 ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Small Cap", "issuer": "iShares"},
    {"symbol": "VBR", "name": "Vanguard Small Cap Value ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Small Cap Value", "issuer": "Vanguard"},
    {"symbol": "VBK", "name": "Vanguard Small Cap Growth ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Small Cap Growth", "issuer": "Vanguard"},
    
    # International Developed ETFs
    {"symbol": "VEA", "name": "Vanguard FTSE Developed Markets ETF", "asset_class": "Equity", "geography": "Developed Ex-U.S.", "category": "International", "issuer": "Vanguard"},
    {"symbol": "IEFA", "name": "iShares Core MSCI EAFE ETF", "asset_class": "Equity", "geography": "Developed Ex-U.S.", "category": "International", "issuer": "iShares"},
    {"symbol": "EFA", "name": "iShares MSCI EAFE ETF", "asset_class": "Equity", "geography": "Developed Ex-U.S.", "category": "International", "issuer": "iShares"},
    {"symbol": "SCHF", "name": "Schwab International Equity ETF", "asset_class": "Equity", "geography": "Developed Ex-U.S.", "category": "International", "issuer": "Schwab"},
    {"symbol": "SPDW", "name": "SPDR Portfolio Developed World ex-US ETF", "asset_class": "Equity", "geography": "Developed Ex-U.S.", "category": "International", "issuer": "SPDR"},
    {"symbol": "VGK", "name": "Vanguard FTSE Europe ETF", "asset_class": "Equity", "geography": "Europe", "category": "Regional", "issuer": "Vanguard"},
    {"symbol": "VPL", "name": "Vanguard FTSE Pacific ETF", "asset_class": "Equity", "geography": "Pacific", "category": "Regional", "issuer": "Vanguard"},
    {"symbol": "EWJ", "name": "iShares MSCI Japan ETF", "asset_class": "Equity", "geography": "Japan", "category": "Country", "issuer": "iShares"},
    
    # Emerging Markets ETFs
    {"symbol": "VWO", "name": "Vanguard FTSE Emerging Markets ETF", "asset_class": "Equity", "geography": "Emerging Markets", "category": "Emerging Markets", "issuer": "Vanguard"},
    {"symbol": "IEMG", "name": "iShares Core MSCI Emerging Markets ETF", "asset_class": "Equity", "geography": "Emerging Markets", "category": "Emerging Markets", "issuer": "iShares"},
    {"symbol": "EEM", "name": "iShares MSCI Emerging Markets ETF", "asset_class": "Equity", "geography": "Emerging Markets", "category": "Emerging Markets", "issuer": "iShares"},
    
    # Total International ETFs
    {"symbol": "VXUS", "name": "Vanguard Total International Stock ETF", "asset_class": "Equity", "geography": "Global Ex-U.S.", "category": "International", "issuer": "Vanguard"},
    {"symbol": "IXUS", "name": "iShares Core MSCI Total International Stock ETF", "asset_class": "Equity", "geography": "Global Ex-U.S.", "category": "International", "issuer": "iShares"},
    {"symbol": "VEU", "name": "Vanguard FTSE All-World ex-US ETF", "asset_class": "Equity", "geography": "Global Ex-U.S.", "category": "International", "issuer": "Vanguard"},
    
    # Global/World ETFs
    {"symbol": "VT", "name": "Vanguard Total World Stock ETF", "asset_class": "Equity", "geography": "Global", "category": "Total World", "issuer": "Vanguard"},
    {"symbol": "ACWI", "name": "iShares MSCI ACWI ETF", "asset_class": "Equity", "geography": "Global", "category": "Total World", "issuer": "iShares"},
    
    # Sector ETFs
    {"symbol": "XLF", "name": "Financial Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Financials", "issuer": "SPDR"},
    {"symbol": "XLV", "name": "Health Care Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Healthcare", "issuer": "SPDR"},
    {"symbol": "XLE", "name": "Energy Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Energy", "issuer": "SPDR"},
    {"symbol": "XLI", "name": "Industrial Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Industrials", "issuer": "SPDR"},
    {"symbol": "XLY", "name": "Consumer Discretionary Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Consumer Discretionary", "issuer": "SPDR"},
    {"symbol": "XLP", "name": "Consumer Staples Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Consumer Staples", "issuer": "SPDR"},
    {"symbol": "XLU", "name": "Utilities Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Utilities", "issuer": "SPDR"},
    {"symbol": "XLB", "name": "Materials Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Materials", "issuer": "SPDR"},
    {"symbol": "XLRE", "name": "Real Estate Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Real Estate", "issuer": "SPDR"},
    {"symbol": "XLC", "name": "Communication Services Select Sector SPDR ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Sector - Communication", "issuer": "SPDR"},
    
    # Bond ETFs
    {"symbol": "BND", "name": "Vanguard Total Bond Market ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Total Bond", "issuer": "Vanguard"},
    {"symbol": "AGG", "name": "iShares Core U.S. Aggregate Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Total Bond", "issuer": "iShares"},
    {"symbol": "BNDX", "name": "Vanguard Total International Bond ETF", "asset_class": "Fixed Income", "geography": "Global Ex-U.S.", "category": "International Bond", "issuer": "Vanguard"},
    {"symbol": "TLT", "name": "iShares 20+ Year Treasury Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Long-Term Treasury", "issuer": "iShares"},
    {"symbol": "IEF", "name": "iShares 7-10 Year Treasury Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Intermediate Treasury", "issuer": "iShares"},
    {"symbol": "SHY", "name": "iShares 1-3 Year Treasury Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Short-Term Treasury", "issuer": "iShares"},
    {"symbol": "VCIT", "name": "Vanguard Intermediate-Term Corporate Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Corporate Bond", "issuer": "Vanguard"},
    {"symbol": "VCSH", "name": "Vanguard Short-Term Corporate Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Corporate Bond", "issuer": "Vanguard"},
    {"symbol": "LQD", "name": "iShares iBoxx $ Investment Grade Corporate Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Corporate Bond", "issuer": "iShares"},
    {"symbol": "HYG", "name": "iShares iBoxx $ High Yield Corporate Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "High Yield Bond", "issuer": "iShares"},
    {"symbol": "JNK", "name": "SPDR Bloomberg High Yield Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "High Yield Bond", "issuer": "SPDR"},
    {"symbol": "SGOV", "name": "iShares 0-3 Month Treasury Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Ultra Short Treasury", "issuer": "iShares"},
    {"symbol": "BIL", "name": "SPDR Bloomberg 1-3 Month T-Bill ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "T-Bill", "issuer": "SPDR"},
    {"symbol": "VTEB", "name": "Vanguard Tax-Exempt Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Municipal Bond", "issuer": "Vanguard"},
    {"symbol": "MUB", "name": "iShares National Muni Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "Municipal Bond", "issuer": "iShares"},
    {"symbol": "TIP", "name": "iShares TIPS Bond ETF", "asset_class": "Fixed Income", "geography": "U.S.", "category": "TIPS", "issuer": "iShares"},
    
    # Commodity ETFs
    {"symbol": "GLD", "name": "SPDR Gold Shares", "asset_class": "Commodity", "geography": "Global", "category": "Gold", "issuer": "SPDR"},
    {"symbol": "IAU", "name": "iShares Gold Trust", "asset_class": "Commodity", "geography": "Global", "category": "Gold", "issuer": "iShares"},
    {"symbol": "GLDM", "name": "SPDR Gold MiniShares Trust", "asset_class": "Commodity", "geography": "Global", "category": "Gold", "issuer": "SPDR"},
    {"symbol": "SLV", "name": "iShares Silver Trust", "asset_class": "Commodity", "geography": "Global", "category": "Silver", "issuer": "iShares"},
    {"symbol": "GDX", "name": "VanEck Gold Miners ETF", "asset_class": "Equity", "geography": "Global", "category": "Gold Miners", "issuer": "VanEck"},
    {"symbol": "USO", "name": "United States Oil Fund", "asset_class": "Commodity", "geography": "Global", "category": "Oil", "issuer": "USCF"},
    {"symbol": "DBC", "name": "Invesco DB Commodity Index Tracking Fund", "asset_class": "Commodity", "geography": "Global", "category": "Broad Commodity", "issuer": "Invesco"},
    
    # Crypto ETFs
    {"symbol": "IBIT", "name": "iShares Bitcoin Trust ETF", "asset_class": "Currency", "geography": "Global", "category": "Bitcoin", "issuer": "iShares"},
    {"symbol": "GBTC", "name": "Grayscale Bitcoin Trust", "asset_class": "Currency", "geography": "Global", "category": "Bitcoin", "issuer": "Grayscale"},
    {"symbol": "BITO", "name": "ProShares Bitcoin Strategy ETF", "asset_class": "Currency", "geography": "Global", "category": "Bitcoin Futures", "issuer": "ProShares"},
    {"symbol": "ETHE", "name": "Grayscale Ethereum Trust", "asset_class": "Currency", "geography": "Global", "category": "Ethereum", "issuer": "Grayscale"},
    {"symbol": "FBTC", "name": "Fidelity Wise Origin Bitcoin Fund", "asset_class": "Currency", "geography": "Global", "category": "Bitcoin", "issuer": "Fidelity"},
    
    # Factor/Smart Beta ETFs
    {"symbol": "QUAL", "name": "iShares MSCI USA Quality Factor ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Factor - Quality", "issuer": "iShares"},
    {"symbol": "MTUM", "name": "iShares MSCI USA Momentum Factor ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Factor - Momentum", "issuer": "iShares"},
    {"symbol": "VLUE", "name": "iShares MSCI USA Value Factor ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Factor - Value", "issuer": "iShares"},
    {"symbol": "SIZE", "name": "iShares MSCI USA Size Factor ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Factor - Size", "issuer": "iShares"},
    {"symbol": "RSP", "name": "Invesco S&P 500 Equal Weight ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Equal Weight", "issuer": "Invesco"},
    
    # Thematic ETFs
    {"symbol": "ARKK", "name": "ARK Innovation ETF", "asset_class": "Equity", "geography": "Global", "category": "Thematic - Innovation", "issuer": "ARK"},
    {"symbol": "ARKG", "name": "ARK Genomic Revolution ETF", "asset_class": "Equity", "geography": "Global", "category": "Thematic - Genomics", "issuer": "ARK"},
    {"symbol": "ARKW", "name": "ARK Next Generation Internet ETF", "asset_class": "Equity", "geography": "Global", "category": "Thematic - Internet", "issuer": "ARK"},
    {"symbol": "ICLN", "name": "iShares Global Clean Energy ETF", "asset_class": "Equity", "geography": "Global", "category": "Thematic - Clean Energy", "issuer": "iShares"},
    {"symbol": "TAN", "name": "Invesco Solar ETF", "asset_class": "Equity", "geography": "Global", "category": "Thematic - Solar", "issuer": "Invesco"},
    
    # Leveraged/Inverse ETFs (popular ones)
    {"symbol": "TQQQ", "name": "ProShares UltraPro QQQ", "asset_class": "Equity", "geography": "U.S.", "category": "Leveraged 3x", "issuer": "ProShares"},
    {"symbol": "SQQQ", "name": "ProShares UltraPro Short QQQ", "asset_class": "Equity", "geography": "U.S.", "category": "Inverse 3x", "issuer": "ProShares"},
    {"symbol": "SPXL", "name": "Direxion Daily S&P 500 Bull 3X Shares", "asset_class": "Equity", "geography": "U.S.", "category": "Leveraged 3x", "issuer": "Direxion"},
    {"symbol": "SPXS", "name": "Direxion Daily S&P 500 Bear 3X Shares", "asset_class": "Equity", "geography": "U.S.", "category": "Inverse 3x", "issuer": "Direxion"},
    {"symbol": "SOXL", "name": "Direxion Daily Semiconductor Bull 3X Shares", "asset_class": "Equity", "geography": "U.S.", "category": "Leveraged 3x", "issuer": "Direxion"},
    {"symbol": "SOXS", "name": "Direxion Daily Semiconductor Bear 3X Shares", "asset_class": "Equity", "geography": "U.S.", "category": "Inverse 3x", "issuer": "Direxion"},
    
    # Income/Options ETFs
    {"symbol": "JEPI", "name": "JPMorgan Equity Premium Income ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Covered Call", "issuer": "JPMorgan"},
    {"symbol": "JEPQ", "name": "JPMorgan NASDAQ Equity Premium Income ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Covered Call", "issuer": "JPMorgan"},
    {"symbol": "XYLD", "name": "Global X S&P 500 Covered Call ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Covered Call", "issuer": "Global X"},
    {"symbol": "QYLD", "name": "Global X NASDAQ 100 Covered Call ETF", "asset_class": "Equity", "geography": "U.S.", "category": "Covered Call", "issuer": "Global X"},
]

# Global Market Indices
GLOBAL_INDICES = [
    # US Indices
    {"symbol": "^GSPC", "name": "S&P 500", "region": "Americas", "country": "USA", "index_type": "Equity"},
    {"symbol": "^DJI", "name": "Dow Jones Industrial Average", "region": "Americas", "country": "USA", "index_type": "Equity"},
    {"symbol": "^IXIC", "name": "NASDAQ Composite", "region": "Americas", "country": "USA", "index_type": "Equity"},
    {"symbol": "^RUT", "name": "Russell 2000", "region": "Americas", "country": "USA", "index_type": "Equity"},
    {"symbol": "^VIX", "name": "CBOE Volatility Index", "region": "Americas", "country": "USA", "index_type": "Volatility"},
    {"symbol": "^TNX", "name": "10-Year Treasury Yield", "region": "Americas", "country": "USA", "index_type": "Bond"},
    
    # European Indices
    {"symbol": "^FTSE", "name": "FTSE 100", "region": "Europe", "country": "UK", "index_type": "Equity"},
    {"symbol": "^GDAXI", "name": "DAX", "region": "Europe", "country": "Germany", "index_type": "Equity"},
    {"symbol": "^FCHI", "name": "CAC 40", "region": "Europe", "country": "France", "index_type": "Equity"},
    {"symbol": "^STOXX50E", "name": "Euro Stoxx 50", "region": "Europe", "country": "Eurozone", "index_type": "Equity"},
    
    # Asian Indices
    {"symbol": "^N225", "name": "Nikkei 225", "region": "Asia", "country": "Japan", "index_type": "Equity"},
    {"symbol": "^HSI", "name": "Hang Seng Index", "region": "Asia", "country": "Hong Kong", "index_type": "Equity"},
    {"symbol": "^KS11", "name": "KOSPI", "region": "Asia", "country": "South Korea", "index_type": "Equity"},
    {"symbol": "^TWII", "name": "Taiwan Weighted Index", "region": "Asia", "country": "Taiwan", "index_type": "Equity"},
    {"symbol": "^BSESN", "name": "BSE Sensex", "region": "Asia", "country": "India", "index_type": "Equity"},
]


def check_fmp_availability(symbol: str) -> dict:
    """Check if a symbol has data available in FMP."""
    url = f"{FMP_BASE_URL}/historical-price-eod/full"
    params = {"symbol": symbol, "apikey": FMP_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return {
                    "available": True,
                    "bars": len(data),
                    "earliest": data[-1]["date"],
                    "latest": data[0]["date"]
                }
        return {"available": False, "bars": 0}
    except Exception as e:
        return {"available": False, "error": str(e)}


def main():
    print("=" * 60)
    print("Compiling ETFs and Indices List")
    print("=" * 60)
    
    # Check ETF availability
    print(f"\nChecking {len(TOP_ETFS)} ETFs...")
    available_etfs = []
    for i, etf in enumerate(TOP_ETFS):
        symbol = etf["symbol"]
        result = check_fmp_availability(symbol)
        if result["available"]:
            etf["fmp_available"] = True
            etf["bars"] = result["bars"]
            available_etfs.append(etf)
            print(f"  [{i+1}/{len(TOP_ETFS)}] {symbol}: ✓ {result['bars']} bars")
        else:
            print(f"  [{i+1}/{len(TOP_ETFS)}] {symbol}: ✗ Not available")
        time.sleep(0.2)
    
    # Check Index availability
    print(f"\nChecking {len(GLOBAL_INDICES)} Indices...")
    available_indices = []
    for i, idx in enumerate(GLOBAL_INDICES):
        symbol = idx["symbol"]
        result = check_fmp_availability(symbol)
        if result["available"]:
            idx["fmp_available"] = True
            idx["bars"] = result["bars"]
            available_indices.append(idx)
            print(f"  [{i+1}/{len(GLOBAL_INDICES)}] {symbol}: ✓ {result['bars']} bars")
        else:
            print(f"  [{i+1}/{len(GLOBAL_INDICES)}] {symbol}: ✗ Not available")
        time.sleep(0.2)
    
    # Save results
    output = {
        "etfs": available_etfs,
        "indices": available_indices,
        "summary": {
            "total_etfs_checked": len(TOP_ETFS),
            "available_etfs": len(available_etfs),
            "total_indices_checked": len(GLOBAL_INDICES),
            "available_indices": len(available_indices)
        }
    }
    
    output_path = "/home/ubuntu/stratos_brain/scripts/etfs_indices_verified.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"ETFs: {len(available_etfs)}/{len(TOP_ETFS)} available")
    print(f"Indices: {len(available_indices)}/{len(GLOBAL_INDICES)} available")
    print(f"\nSaved to: {output_path}")


if __name__ == "__main__":
    main()
