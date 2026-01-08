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

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": tvSymbol,
      "interval": interval,
      "timezone": "Etc/UTC",
      "theme": theme,
      "style": "1", // Candlestick
      "locale": "en",
      "allow_symbol_change": false,
      "calendar": false,
      "support_host": "https://www.tradingview.com",
      "hide_side_toolbar": true,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "backgroundColor": theme === 'dark' ? "rgba(0, 0, 0, 0)" : "rgba(255, 255, 255, 1)",
      "gridColor": theme === 'dark' ? "rgba(66, 66, 66, 0.3)" : "rgba(200, 200, 200, 0.3)",
      "withdateranges": true,
      "details": false,
      "hotlist": false,
      "studies": [
        "STD;RSI",
        "STD;SMA",
        "STD;SMA"
      ],
      "studies_overrides": {
        "moving average.length": 20,
        "moving average.plot.color": "#2962FF",
        "moving average#1.length": 50,
        "moving average#1.plot.color": "#FF6D00"
      }
    });

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    container.current.appendChild(widgetContainer);
    widgetContainer.appendChild(script);

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
