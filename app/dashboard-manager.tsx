"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CircleDollarSign, ReceiptText, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { authFetch } from "@/lib/client-auth";

type DashboardData = {
  selectedMonth: string;
  availableMonths: string[];
  summary: {
    sales: number;
    outstanding: number;
    costing: number;
    grossProfit: number;
    grossProfitPercentage: number;
    lowStock: number;
  };
  daily: Array<{ day: number; label: string; sales: number; costing: number; profit: number }>;
};

const currency = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  );
}

function performance(percent: number) {
  if (percent < 10) return "Low";
  if (percent < 20) return "Moderate";
  if (percent < 30) return "Healthy";
  return "Strong";
}

export function DashboardManager() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (selectedMonth?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = selectedMonth ? `?month=${encodeURIComponent(selectedMonth)}` : "";
      const response = await authFetch(`/api/dashboard${query}`, { cache: "no-store" });
      const result = await response.json();
      if (response.status === 401) {
        window.location.reload();
        return;
      }
      if (!response.ok) throw new Error(result.error || "Unable to load dashboard data.");
      setData(result);
      setMonth(result.selectedMonth);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial API hydration intentionally updates the dashboard state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const guide = useMemo(() => performance(data?.summary.grossProfitPercentage || 0), [data]);
  if (loading && !data) return <div className="card dashboard-state">Loading dashboard...</div>;
  if (error && !data) return <div className="card dashboard-state error-state">{error}<button className="btn" onClick={() => void load()}>Try again</button></div>;
  if (!data) return null;

  const summary = data.summary;
  return (
    <section className="dashboard-page">
      <div className="page-head row between dashboard-heading">
        <div><h2>Dashboard</h2><p>Live sales, profit and inventory overview.</p></div>
        <label className="month-select">Reporting month<select value={month} onChange={(event) => { setMonth(event.target.value); void load(event.target.value); }} disabled={loading}>{data.availableMonths.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}</select></label>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="grid-4 dashboard-metrics">
        <DashboardMetric label="Total Sales" value={currency.format(summary.sales)} detail={monthLabel(data.selectedMonth)} icon={CircleDollarSign} />
        <DashboardMetric label="Outstanding" value={currency.format(summary.outstanding)} detail="Unpaid invoice balance" icon={ReceiptText} />
        <DashboardMetric label="Total Gross Profit(NOT INCLUDED SALARY & LABOUR)" value={currency.format(summary.grossProfit)} detail={`${summary.grossProfitPercentage.toFixed(1)}% gross profit`} icon={TrendingUp} />
        <DashboardMetric label="Low Stock Items" value={String(summary.lowStock)} detail="Current inventory status" icon={AlertTriangle} />
      </div>
      <div className="dashboard-second-row">
        <div className="card pad profit-guide">
          <div className="row between"><div><h3 className="section-title">Profit Guide</h3><p className="section-sub">Performance for {monthLabel(data.selectedMonth)}</p></div><span className={`profit-rating rating-${guide.toLowerCase()}`}>{guide}</span></div>
          <div className="profit-percent">{summary.grossProfitPercentage.toFixed(1)}%</div>
          <div className="profit-track" aria-label={`Gross profit ${summary.grossProfitPercentage.toFixed(1)} percent`}><span style={{ width: `${Math.max(0, Math.min(100, summary.grossProfitPercentage))}%` }} /></div>
          <div className="profit-breakdown"><span>Sales <b>{currency.format(summary.sales)}</b></span><span>Costing(NOT INCLUDED SALARY & LABOUR) <b>{currency.format(summary.costing)}</b></span><span>Gross Profit <b>{currency.format(summary.grossProfit)}</b></span></div>
        </div>
        <div className="card pad monthly-sales-card">
          <div><h3 className="section-title">Monthly Sales</h3><p className="section-sub">Daily sales, costing and profit</p></div>
          <div className="monthly-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ top: 18, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebef" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={9} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} fontSize={9} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                <Tooltip formatter={(value) => currency.format(Number(value))} labelFormatter={(label) => `${label} ${monthLabel(data.selectedMonth)}`} />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill="#2e9d57" radius={[3, 3, 0, 0]} />
                <Bar dataKey="costing" name="Costing" fill="#e2b93b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#d9534f" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMetric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof CircleDollarSign }) {
  return <div className="card metric dashboard-metric"><div className="row between"><span className="metric-label">{label}</span><span className="kpi-icon"><Icon size={16} /></span></div><div className="metric-value number">{value}</div><div className="delta">{detail}</div></div>;
}
