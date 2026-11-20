import { addDays } from "../clock";
import { formatDay } from "../format";

/** Open-Meteo forecasts reach today and the fifteen days after it. */
export const FORECAST_DAYS = 16;

const HOURS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23,
];

const selectClass = "rounded-lg border border-slate-300 bg-white px-3 py-2";

export function HourSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (hour: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="text-slate-600">
        時刻
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}時
          </option>
        ))}
      </select>
    </div>
  );
}

export function DateSelect({
  id,
  today,
  value,
  onChange,
}: {
  id: string;
  today: string;
  value: string;
  onChange: (date: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="text-slate-600">
        日付
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {Array.from({ length: FORECAST_DAYS }, (_, i) => {
          const date = addDays(today, i);
          return (
            <option key={date} value={date}>
              {formatDay(date)}
            </option>
          );
        })}
      </select>
    </div>
  );
}
