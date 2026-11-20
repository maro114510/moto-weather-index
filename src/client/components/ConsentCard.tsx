import { MapPin } from "lucide-react";
import { usePlace } from "../place";

const button = "rounded-lg px-4 py-2 font-medium text-sm disabled:opacity-60";
const primary = `${button} bg-slate-900 text-white hover:bg-slate-700`;
const secondary = `${button} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;

/** The only place the rider grants, uses, or withdraws the current location. */
export function ConsentCard() {
  const place = usePlace();
  const { consent, isLocating } = place;

  return (
    <section
      aria-labelledby="consent-title"
      className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-5"
    >
      <h2
        id="consent-title"
        className="flex items-center gap-2 font-semibold text-slate-900"
      >
        <MapPin aria-hidden className="size-5 text-sky-700" />
        現在地の利用
      </h2>
      <p className="text-slate-700 text-sm">
        現在地を使う場合、その場所の天気とツーリング指数を表示するために、座標をこのサービスと天気の提供元であるOpen-Meteoへ送信します。座標はこの端末に最大24時間保存されます。
      </p>

      {place.locationError && (
        <p role="alert" className="text-red-700 text-sm">
          {place.locationError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {consent === "granted" ? (
          <>
            <button
              type="button"
              className={primary}
              disabled={isLocating}
              onClick={() => void place.enableCurrentLocation()}
            >
              {isLocating ? "現在地を取得中…" : "現在地を更新"}
            </button>
            <button
              type="button"
              className={secondary}
              onClick={place.deleteStoredLocation}
            >
              保存した現在地を削除
            </button>
            <button
              type="button"
              className={secondary}
              onClick={place.withdrawConsent}
            >
              同意を撤回
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={primary}
              disabled={isLocating}
              onClick={() => void place.enableCurrentLocation()}
            >
              {isLocating ? "現在地を取得中…" : "同意して現在地を利用"}
            </button>
            {consent === "unset" ? (
              <button
                type="button"
                className={secondary}
                onClick={place.declineCurrentLocation}
              >
                同意しない
              </button>
            ) : (
              <p className="text-slate-600 text-sm">
                現在地を使用しない設定です。検索した地点や東京は引き続き利用できます。
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
