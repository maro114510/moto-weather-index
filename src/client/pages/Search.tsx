import { type FormEvent, useState } from "react";
import { getIndex, type PlaceCandidate, searchPlaces } from "../api";
import { jstHour, jstToday } from "../clock";
import { IndexView } from "../components/IndexView";
import { DateSelect, HourSelect } from "../components/Pickers";
import { RemoteView } from "../components/Remote";
import { useRemote } from "../useRemote";

function Chosen({ place }: { place: PlaceCandidate }) {
  const today = jstToday();
  const [date, setDate] = useState(today);
  const [hour, setHour] = useState(() => jstHour());
  const state = useRemote(
    (signal) => getIndex(place, { date, hour }, signal),
    `${place.latitude},${place.longitude},${date},${hour}`,
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <DateSelect
          id="search-date"
          today={today}
          value={date}
          onChange={setDate}
        />
        <HourSelect id="search-hour" value={hour} onChange={setHour} />
      </div>
      <RemoteView state={state}>
        {(index) => <IndexView index={index} />}
      </RemoteView>
    </div>
  );
}

type Candidates = { places: PlaceCandidate[]; term: string };

function Results({
  places,
  onPick,
}: {
  places: PlaceCandidate[];
  onPick: (place: PlaceCandidate) => void;
}) {
  if (places.length === 0) {
    return (
      <p role="status" className="text-slate-600">
        該当する地点が見つかりませんでした。
      </p>
    );
  }
  return (
    <ul
      aria-label="検索結果"
      className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm"
    >
      {places.map((place) => (
        <li key={`${place.latitude},${place.longitude}`}>
          <button
            type="button"
            onClick={() => onPick(place)}
            className="w-full px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="font-medium">{place.name}</span>
            {place.region && (
              <span className="ml-2 text-slate-500 text-sm">
                {place.region}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SearchPage() {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [chosen, setChosen] = useState<PlaceCandidate | null>(null);
  const state = useRemote<Candidates | null>(
    async (signal) =>
      submitted === null
        ? null
        : { places: await searchPlaces(submitted, signal), term: submitted },
    submitted ?? "",
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const term = text.trim();
    if (term === "") return;
    setChosen(null);
    setSubmitted(term);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-bold text-3xl text-slate-900">地域・日付指定</h1>

      <form onSubmit={submit} className="flex gap-2">
        <input
          type="search"
          aria-label="地名"
          placeholder="例: 箱根、金沢"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-5 py-2 font-medium text-white hover:bg-slate-700"
        >
          検索
        </button>
      </form>

      {submitted !== null && (
        <RemoteView state={state}>
          {(result) =>
            result && <Results places={result.places} onPick={setChosen} />
          }
        </RemoteView>
      )}

      {chosen && (
        <Chosen key={`${chosen.latitude},${chosen.longitude}`} place={chosen} />
      )}
    </div>
  );
}
