import { CalendarDays, MapPin, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { getIndex } from "../api";
import { jstToday } from "../clock";
import { ConsentCard } from "../components/ConsentCard";
import { IndexView } from "../components/IndexView";
import { RemoteView } from "../components/Remote";
import { usePlace } from "../place";
import { useRemote } from "../useRemote";

const linkClass =
  "block rounded-lg bg-slate-900 px-4 py-2 text-center font-medium text-sm text-white hover:bg-slate-700";

export function HomePage() {
  const { place, consent } = usePlace();
  const state = useRemote(
    (signal) => getIndex(place, undefined, signal),
    `${place.latitude},${place.longitude}`,
  );

  return (
    <div className="space-y-10">
      <section className="space-y-2 text-center">
        <h1 className="font-bold text-3xl text-slate-900 md:text-4xl">
          ツーリング日和指数
        </h1>
        <p className="text-slate-600">
          天気条件と道路の安全要因から、ツーリングの快適さを0から100の1つの指数にまとめます。
        </p>
      </section>

      {consent === "unset" && <ConsentCard />}

      <RemoteView state={state}>
        {(index) => <IndexView index={index} />}
      </RemoteView>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <MapPin aria-hidden className="size-6 text-cyan-500" />
          <h2 className="font-semibold">地域・日付指定</h2>
          <p className="text-slate-600 text-sm">
            お好みの地域と日付で指数をチェック
          </p>
          <Link to="/search" className={linkClass}>
            指定して見る
          </Link>
        </div>
        <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <CalendarDays aria-hidden className="size-6 text-green-500" />
          <h2 className="font-semibold">週間カレンダー</h2>
          <p className="text-slate-600 text-sm">1週間分の指数をまとめて確認</p>
          <Link to="/calendar" className={linkClass}>
            週間をチェック
          </Link>
        </div>
        <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <TrendingUp aria-hidden className="size-6 text-purple-400" />
          <h2 className="font-semibold">指数の内訳</h2>
          <p className="text-slate-600 text-sm">要素別の点数と算出の根拠</p>
          <Link to={`/details/${jstToday()}`} className={linkClass}>
            内訳を見る
          </Link>
        </div>
      </section>
    </div>
  );
}
