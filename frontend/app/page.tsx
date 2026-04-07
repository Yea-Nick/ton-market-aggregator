import { TonDashboard } from '@/components/TonDashboard';
import { fetchPriceHistory } from '@/lib/api';
import { EXCHANGES, Exchange, TimeRange } from '@/lib/types';

export default async function Page() {
  const symbol = process.env.NEXT_PUBLIC_SYMBOL ?? 'TONUSDT';
  const initialRange: TimeRange = '1h';
  const initialExchanges: Exchange[] = EXCHANGES;
  const initialPoints = await fetchPriceHistory(symbol, initialRange, initialExchanges);

  return (
    <TonDashboard
      symbol={symbol}
      initialRange={initialRange}
      initialExchanges={initialExchanges}
      initialPoints={initialPoints}
    />
  );
}
