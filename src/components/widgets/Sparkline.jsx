/** Line plus soft fill. `values` is plain numbers, oldest first. */
export const Sparkline = ({ values = [], width = 220, height = 44, stroke = "currentColor" }) => {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />;

  const max = Math.max(...values);
  const min = Math.min(...values);
  // a flat series would divide by zero
  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  const point = (value, i) => {
    const x = i * stepX;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return [x, y];
  };

  const points = values.map(point);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const area = `${line}L${width},${height}L0,${height}Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={area} fill={stroke} opacity="0.14" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

/** A fill bar, for capacities like disk. */
export const Bar = ({ pct = 0, height = 4 }) => {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="capacity" style={{ height }} role="img" aria-label={`${Math.round(clamped)}% used`}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
};

/**
 * GitHub-style contribution grid: one column per week, seven rows, oldest
 * column first. `days` is [{ date, count }] in chronological order.
 */
export const Heatmap = ({ days = [], cell = 9, gap = 2.5 }) => {
  if (!days.length) return null;

  // pad the front so the first column starts on the right weekday
  const offset = new Date(days[0].date + "T00:00:00").getDay();
  const padded = [...Array(offset).fill(null), ...days];
  const weeks = Math.ceil(padded.length / 7);

  const busiest = Math.max(...days.map((d) => d.count), 1);
  const level = (count) => {
    if (!count) return 0;
    const ratio = count / busiest;
    if (ratio > 0.66) return 4;
    if (ratio > 0.33) return 3;
    if (ratio > 0.12) return 2;
    return 1;
  };

  const width = weeks * (cell + gap) - gap;
  const height = 7 * (cell + gap) - gap;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="heatmap"
      role="img"
      aria-label={`${days.length} days of contributions`}
    >
      {padded.map((day, i) =>
        day === null ? null : (
          <rect
            key={day.date}
            x={Math.floor(i / 7) * (cell + gap)}
            y={(i % 7) * (cell + gap)}
            width={cell}
            height={cell}
            rx="2"
            className={`lvl-${level(day.count)}`}
          >
            <title>{`${day.count} on ${day.date}`}</title>
          </rect>
        )
      )}
    </svg>
  );
};
