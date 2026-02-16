/**
 * Time-series probability chart for market pool history.
 * Uses Supabase pool snapshots to render YES/NO probability over time
 * via recharts area chart.
 */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePoolHistory } from "../hooks/usePoolHistory";

interface PoolHistoryChartProps {
  marketId: string;
}

interface ChartPoint {
  time: string;
  timestamp: number;
  yesProb: number;
  noProb: number;
}

/** Format a date for the X axis label. */
function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Renders a stacked area chart showing YES/NO probability over time.
 * Falls back to a message when no snapshot data is available.
 */
export function PoolHistoryChart({ marketId }: PoolHistoryChartProps) {
  const { data: snapshots, isLoading } = usePoolHistory(marketId);

  if (isLoading) {
    return (
      <div className="text-center text-gray-500 text-sm py-8">
        <span className="css-spinner-sm" /> Loading chart...
      </div>
    );
  }

  if (!snapshots || snapshots.length < 2) {
    return (
      <div className="text-center text-gray-600 text-sm py-8">
        Not enough data for chart yet. Check back after more bets.
      </div>
    );
  }

  const chartData: ChartPoint[] = snapshots.map((s: Record<string, unknown>) => {
    const yes = Number(s.yesPool ?? s.yes_pool ?? 0);
    const no = Number(s.noPool ?? s.no_pool ?? 0);
    const total = yes + no;
    const yesProb = total > 0 ? (yes / total) * 100 : 50;
    const ts = new Date(String(s.capturedAt ?? s.captured_at ?? "")).getTime();
    return {
      time: formatDate(ts),
      timestamp: ts,
      yesProb: Math.round(yesProb * 10) / 10,
      noProb: Math.round((100 - yesProb) * 10) / 10,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <defs>
          <linearGradient id="yesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="noGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fill: "#6b7280", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#6b7280", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1f3a",
            border: "1px solid #2d3561",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `${value}%`,
            name === "yesProb" ? "YES" : "NO",
          ]}
        />
        <Area
          type="monotone"
          dataKey="yesProb"
          stroke="#10b981"
          fill="url(#yesGrad)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="noProb"
          stroke="#f43f5e"
          fill="url(#noGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
