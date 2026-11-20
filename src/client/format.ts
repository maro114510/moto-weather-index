import type {
  Confidence,
  FactorKey,
  Rating,
  Target,
} from "../domain/TouringIndex";

const FACTOR_LABELS: Record<FactorKey, string> = {
  weather: "天気",
  temperature: "気温",
  wind: "風速",
  humidity: "湿度",
  visibility: "視程",
  precipitationProbability: "降水確率",
  uvIndex: "UV指数",
  airQuality: "大気質",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "信頼度 高",
  medium: "信頼度 中",
  low: "信頼度 低",
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function factorLabel(key: FactorKey): string {
  return FACTOR_LABELS[key];
}

export function confidenceLabel(confidence: Confidence): string {
  return CONFIDENCE_LABELS[confidence];
}

const JST_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The instant the weather source answered, in Japan Standard Time. */
export function formatFreshness(iso: string): string {
  const parts = Object.fromEntries(
    JST_PARTS.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

/** A calendar date has the same weekday everywhere, so UTC arithmetic suffices. */
export function formatDay(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${month}月${day}日(${weekday})`;
}

export function formatTarget(target: Target): string {
  return target.type === "moment"
    ? `${formatDay(target.date)} ${target.hour}時`
    : formatDay(target.date);
}

const RATING_CLASSES: Record<Rating["color"], { badge: string; bar: string }> =
  {
    green: { badge: "bg-green-100 text-green-800", bar: "bg-green-500" },
    lime: { badge: "bg-lime-100 text-lime-800", bar: "bg-lime-500" },
    yellow: { badge: "bg-yellow-100 text-yellow-800", bar: "bg-yellow-500" },
    orange: { badge: "bg-orange-100 text-orange-800", bar: "bg-orange-500" },
    red: { badge: "bg-red-100 text-red-800", bar: "bg-red-500" },
  };

export function ratingClasses(color: Rating["color"]) {
  return RATING_CLASSES[color];
}
