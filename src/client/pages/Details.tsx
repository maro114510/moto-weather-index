import { useState } from "react";
import { Link, useParams } from "react-router";
import { getIndex } from "../api";
import { addDays, jstHour, jstToday } from "../clock";
import { IndexView } from "../components/IndexView";
import { FORECAST_DAYS, HourSelect } from "../components/Pickers";
import { RemoteView } from "../components/Remote";
import { usePlace } from "../place";
import { useRemote } from "../useRemote";

const MIDDAY = 12;

function Breakdown({ date }: { date: string }) {
  const { place } = usePlace();
  const [hour, setHour] = useState(() =>
    date === jstToday() ? jstHour() : MIDDAY,
  );
  const state = useRemote(
    (signal) => getIndex(place, { date, hour }, signal),
    `${place.latitude},${place.longitude},${date},${hour}`,
  );

  return (
    <div className="space-y-6">
      <HourSelect id="details-hour" value={hour} onChange={setHour} />
      <RemoteView state={state}>
        {(index) => <IndexView index={index} />}
      </RemoteView>
    </div>
  );
}

export function DetailsPage() {
  const { date = "" } = useParams();
  const today = jstToday();
  const last = addDays(today, FORECAST_DAYS - 1);
  const inRange =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && date <= last;

  return (
    <div className="space-y-6">
      <h1 className="font-bold text-3xl text-slate-900">指数の内訳</h1>
      {inRange ? (
        <Breakdown key={date} date={date} />
      ) : (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900"
        >
          <p>表示できる日付は今日から15日後までです。</p>
          <Link to={`/details/${today}`} className="underline">
            今日の内訳を見る
          </Link>
        </div>
      )}
    </div>
  );
}
