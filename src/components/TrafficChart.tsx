import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { formatBytes } from '~/lib/utils';
import type { TrafficDataPoint } from '~/lib/api';

interface TrafficChartProps {
  title?: string;
  fetchData: (range: string) => Promise<TrafficDataPoint[]>;
}

export function TrafficChart({ title = 'Traffic', fetchData }: TrafficChartProps) {
  const [range, setRange] = useState('24h');
  const [data, setData] = useState<TrafficDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchData(range)
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range, fetchData]);

  const chartData = data.map((d) => ({
    time: new Date(d.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    rx: d.rx_bytes,
    tx: d.tx_bytes,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        <Tabs value={range} onValueChange={setRange}>
          <TabsList className="h-8">
            <TabsTrigger value="1h" className="text-xs px-2">1H</TabsTrigger>
            <TabsTrigger value="24h" className="text-xs px-2">24H</TabsTrigger>
            <TabsTrigger value="7d" className="text-xs px-2">7D</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-2">30D</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No traffic data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBytes(v)} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatBytes(value),
                  name === 'rx' ? 'Received' : 'Sent',
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Legend formatter={(value) => (value === 'rx' ? 'Received' : 'Sent')} />
              <Line type="monotone" dataKey="rx" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tx" stroke="hsl(221, 83%, 53%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
