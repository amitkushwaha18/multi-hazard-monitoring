import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const hourLabel = (timeArr, i) => {
  const t = timeArr?.[i];
  if (!t) return '--:--';
  return String(t).slice(11, 16);
};

const sampleEveryThird = (arr) => (arr || []).filter((_, i) => i % 3 === 0);

const round1 = (v) => Math.round((v || 0) * 10) / 10;

const buildChartData = (telemetry, metric) => {
  const data = [];
  const history = telemetry?.history;
  const forecast = telemetry?.hourlyForecast;
  const isRain = metric === 'rain';

  const pastArr = history ? (isRain ? history.precipitation : history.temperature_2m) : [];
  const futArr = forecast ? (isRain ? forecast.precipitation : forecast.temperature_2m) : [];
  const pastTime = history?.time || [];
  const futTime = forecast?.time || [];

  const past = sampleEveryThird(pastArr).slice(-8);
  const future = sampleEveryThird(futArr).slice(0, 8);
  const pastTimes = sampleEveryThird(pastTime).slice(-8);
  const futureTimes = sampleEveryThird(futTime).slice(0, 8);

  past.forEach((v, i) => {
    data.push({ time: `Past ${hourLabel(pastTimes, i)}`, actual: round1(v), forecast: null });
  });

  const liveNow = isRain
    ? (telemetry?.currentPrecipitation ?? 0)
    : (telemetry?.currentTemperature ?? 0);
  const nowValue = round1(liveNow || 0);
  data.push({ time: 'NOW', actual: nowValue, forecast: nowValue });

  future.forEach((v, i) => {
    data.push({ time: `LSTM ${hourLabel(futureTimes, i)}`, actual: null, forecast: round1(v) });
  });

  return data;
};

const TimeSeriesChart = ({ locationName, telemetry }) => {
  const [activeMetric, setActiveMetric] = useState('rain');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    setChartData(buildChartData(telemetry, activeMetric));
  }, [activeMetric, telemetry]);

  const metricConfig = {
    rain: { label: 'Rainfall (mm)', color: '#38bdf8' },
    temp: { label: 'Temperature (°C)', color: '#ef4444' }
  };

  return (
    <div style={{
      marginTop: '20px',
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="mh-flex-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', background: 'linear-gradient(90deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🧠 LSTM Predictive Time-Series Forecaster
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#38bdf8' }}>
            {locationName ? `Active Location: ${locationName}` : 'Select a location to update telemetry graph'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveMetric('rain')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #38bdf8',
              background: activeMetric === 'rain' ? '#0284c7' : 'transparent',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Rainfall (mm)
          </button>
          <button
            onClick={() => setActiveMetric('temp')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #ef4444',
              background: activeMetric === 'temp' ? '#dc2626' : 'transparent',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Temperature (°C)
          </button>
        </div>
      </div>

      <div style={{ width: '100%', height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metricConfig[activeMetric].color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={metricConfig[activeMetric].color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '11px' }} />
            <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
            <Tooltip 
              contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
            />
            <Area 
              type="monotone" 
              dataKey="actual" 
              stroke={metricConfig[activeMetric].color} 
              fillOpacity={1} 
              fill="url(#colorMetric)" 
              strokeWidth={2}
              name="Historical Data"
            />
            <Area 
              type="monotone" 
              dataKey="forecast" 
              stroke="#f59e0b" 
              strokeDasharray="5 5" 
              fill="transparent" 
              strokeWidth={2}
              name="LSTM Forecast Target"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TimeSeriesChart;