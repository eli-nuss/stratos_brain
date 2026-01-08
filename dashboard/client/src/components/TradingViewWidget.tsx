import { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  assetType: 'crypto' | 'equity';
  theme?: 'dark' | 'light';
  interval?: string;
}

function TradingViewWidget({ 
  symbol, 
  assetType, 
  theme = 'dark',
  interval = 'D'
}: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  // Convert symbol to TradingView format
  const getTradingViewSymbol = (sym: string, type: 'crypto' | 'equity') => {
    if (type === 'crypto') {
      // Common crypto symbols - try Binance first, then Coinbase
      const binanceSymbols = ['BTC', 'ETH', 'SOL', 'SUI', 'DOGE', 'PEPE', 'SHIB', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC', 'UNI', 'AAVE', 'LTC', 'BCH', 'ATOM', 'FIL', 'NEAR', 'APT', 'ARB', 'OP', 'INJ', 'TIA', 'SEI', 'BONK', 'WIF', 'FLOKI', 'PENGU', 'VIRTUAL', 'HYPE', 'ENA', 'ZEC', 'THETA', 'FET', 'RENDER', 'TAO', 'RNDR'];
      
      if (binanceSymbols.includes(sym.toUpperCase())) {
        return `BINANCE:${sym.toUpperCase()}USDT`;
      }
      // Fallback to CRYPTO exchange
      return `CRYPTO:${sym.toUpperCase()}USD`;
    } else {
      // For equities, use the symbol directly (TradingView will find the exchange)
      return sym.toUpperCase();
    }
  };

  useEffect(() => {
    if (!container.current) return;

    // Clear any existing widget
    container.current.innerHTML = '';

    const tvSymbol = getTradingViewSymbol(symbol, assetType);

    // Create the widget container div
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";

    // Create the copyright div (required by TradingView)
    const copyrightDiv = document.createElement("div");
    copyrightDiv.className = "tradingview-widget-copyright";
    copyrightDiv.innerHTML = `<a href="https://www.tradingview.com/symbols/${tvSymbol}/" rel="noopener nofollow" target="_blank"><span class="blue-text">${symbol} chart</span></a><span class="trademark"> by TradingView</span>`;
    copyrightDiv.style.fontSize = "11px";
    copyrightDiv.style.color = theme === 'dark' ? "#9db2bd" : "#787b86";
    copyrightDiv.style.textAlign = "center";
    copyrightDiv.style.padding = "4px 0";

    // Create the script element
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    
    // Configuration matching exactly what TradingView widget builder produces
    const config = {
      "autosize": true,
      "symbol": tvSymbol,
      "interval": interval,
      "timezone": "America/New_York",
      "theme": theme,
      "style": "1",
      "locale": "en",
      "allow_symbol_change": false,
      "calendar": false,
      "hide_side_toolbar": false,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "hide_volume": false,
      "save_image": true,
      "withdateranges": true,
      "details": false,
      "hotlist": false,
      "backgroundColor": theme === 'dark' ? "rgba(17, 17, 17, 1)" : "rgba(255, 255, 255, 1)",
      "gridColor": theme === 'dark' ? "rgba(66, 66, 66, 0.3)" : "rgba(200, 200, 200, 0.3)",
      "watchlist": [],
      "compareSymbols": [],
      "studies": [
        "STD;RSI",
        "STD;SMA",
        "STD;SMA"
      ]
    };
    
    script.innerHTML = JSON.stringify(config);

    // Append elements in the correct order
    container.current.appendChild(widgetDiv);
    container.current.appendChild(copyrightDiv);
    widgetDiv.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbol, assetType, theme, interval]);

  return (
    <div 
      ref={container} 
      className="tradingview-widget-container" 
      style={{ height: '100%', width: '100%' }}
    />
  );
}

export default memo(TradingViewWidget);
