import { useState } from "react";
import { Link } from "react-router";
import type { TouringIndex } from "../../domain/TouringIndex";
import { getHorizon } from "../api";
import { jstToday } from "../clock";
import { IndexView } from "../components/IndexView";
import { RemoteView } from "../components/Remote";
import { confidenceLabel, formatDay, ratingClasses } from "../format";
import { usePlace } from "../place";
import { useRemote } from "../useRemote";

function WeekView({ days }: { days: TouringIndex[] }) {
  const today = jstToday();
  const [selected, setSelected] = useState(days[0]?.target.date);
  const current = days.find((d) => d.target.date === selected) ?? days[0];

  return (
    <div className="space-y-6">
      <ul
        aria-label="1週間の指数"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
      >
        {days.map((day) => {
          const isSelected = day.target.date === current?.target.date;
          return (
            <li key={day.target.date}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelected(day.target.date)}
                className={`flex h-full w-full flex-col gap-2 rounded-xl border bg-white p-3 text-left ${
                  isSelected
                    ? "border-cyan-400 ring-2 ring-cyan-300"
                    : "border-slate-200"
                }`}
              >
                <span className="text-slate-500 text-xs">
                  {formatDay(day.target.date)}
                  {day.target.date === today && " 今日"}
                </span>
                <span className="font-bold text-2xl">{day.score}</span>
                <span
                  className={`w-fit rounded-full px-2 py-0.5 font-medium text-xs ${ratingClasses(day.rating.color).badge}`}
                >
                  {day.rating.label}
                </span>
                <span className="text-slate-500 text-xs">
                  {confidenceLabel(day.confidence)}
                </span>
                {day.missingFactors.length > 0 && (
                  <span className="text-amber-700 text-xs">要素不足</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {current && (
        <section aria-label="選択した日の指数" className="space-y-3">
          <IndexView index={current} />
          <Link
            to={`/details/${current.target.date}`}
            className="inline-block rounded-lg border border-cyan-300 px-4 py-2 text-cyan-800 text-sm hover:bg-cyan-50"
          >
            この日の内訳を見る
          </Link>
        </section>
      )}
    </div>
  );
}

export function CalendarPage() {
  const { place } = usePlace();
  const state = useRemote(
    (signal) => getHorizon(place, signal),
    `${place.latitude},${place.longitude}`,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-bold text-3xl text-slate-900">週間カレンダー</h1>
        <p className="text-slate-600 text-sm">
          {place.name}の今日から1週間の予報です。
        </p>
      </div>
      <RemoteView state={state}>
        {(days) => <WeekView days={days} />}
      </RemoteView>
    </div>
  );
}
