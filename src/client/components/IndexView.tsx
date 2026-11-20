import type { TouringIndex } from "../../domain/TouringIndex";
import {
  confidenceLabel,
  factorLabel,
  formatFreshness,
  formatTarget,
  ratingClasses,
} from "../format";

const OPEN_METEO_URL = "https://open-meteo.com/";

/**
 * Presents one index completely: its place and target, score and rating,
 * factors, missing factors, confidence, source, and freshness. Every screen
 * that shows an index renders this view, so none can omit a part.
 */
export function IndexView({ index }: { index: TouringIndex }) {
  const classes = ratingClasses(index.rating.color);
  const incomplete = index.missingFactors.length > 0;

  return (
    <article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-xl text-slate-900">
            {index.place.name}
          </h2>
          <p className="text-slate-500 text-sm">{formatTarget(index.target)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 font-semibold text-sm ${classes.badge}`}
          >
            {index.rating.label}
          </span>
          <span className="text-slate-500 text-sm">
            {confidenceLabel(index.confidence)}
          </span>
        </div>
      </header>

      <div className="flex items-baseline gap-2">
        <output
          aria-label="ツーリング指数"
          className="font-bold text-5xl text-slate-900"
        >
          {index.score}
        </output>
        <span className="text-slate-500">/ 100</span>
      </div>

      {incomplete && (
        <div
          role="note"
          className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm"
        >
          <p>
            一部の要素を取得できなかったため、取得できた要素だけで算出しています。他の指数と単純には比べられません。
          </p>
          <ul
            aria-label="取得できなかった要素"
            className="flex flex-wrap gap-2"
          >
            {index.missingFactors.map((key) => (
              <li
                key={key}
                className="rounded-full bg-amber-100 px-2 py-0.5 font-medium"
              >
                {factorLabel(key)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul aria-label="要素別の点数" className="space-y-3">
        {index.factors.map((factor) => (
          <li key={factor.key}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">{factorLabel(factor.key)}</span>
              <span className="font-medium text-slate-900">
                {factor.points} / {factor.max}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full ${classes.bar}`}
                style={{ width: `${(factor.points / factor.max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <footer className="border-slate-100 border-t pt-3 text-slate-500 text-xs">
        <p>
          出典:{" "}
          <a
            className="underline"
            href={OPEN_METEO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            {index.source}
          </a>{" "}
          · 取得時刻 {formatFreshness(index.freshness)}
        </p>
      </footer>
    </article>
  );
}
