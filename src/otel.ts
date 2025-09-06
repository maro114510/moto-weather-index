import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Allow disabling via env (support non-standard OTEL_ENABLED as well)
const otelEnabledEnv = process.env.OTEL_ENABLED;
const otelDisabled =
  process.env.OTEL_SDK_DISABLED === "true" ||
  (otelEnabledEnv ? /^(false|0|no)$/i.test(otelEnabledEnv) : false);

if (otelDisabled) {
  // Do not initialize SDK when explicitly disabled
  // eslint-disable-next-line no-console
  console.info("[otel] OpenTelemetry is disabled by OTEL_SDK_DISABLED=true");
} else {
  // Enable minimal internal diagnostics when requested
  if (process.env.OTEL_DIAG_LOG_LEVEL) {
    const level = process.env.OTEL_DIAG_LOG_LEVEL.toUpperCase();
    const map: Record<string, DiagLogLevel> = {
      ALL: DiagLogLevel.ALL,
      VERBOSE: DiagLogLevel.VERBOSE,
      DEBUG: DiagLogLevel.DEBUG,
      INFO: DiagLogLevel.INFO,
      WARN: DiagLogLevel.WARN,
      ERROR: DiagLogLevel.ERROR,
      NONE: DiagLogLevel.NONE,
    };
    diag.setLogger(new DiagConsoleLogger(), map[level] ?? DiagLogLevel.WARN);
  }

  function parseHeaders(input?: string): Record<string, string> {
    if (!input) return {};
    return input.split(",").reduce<Record<string, string>>((acc, raw) => {
      const pair = raw.trim();
      if (!pair) return acc;
      const idx = pair.indexOf("=");
      if (idx <= 0) return acc;
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k) acc[k] = decodeURIComponent(v);
      return acc;
    }, {});
  }

  // Non-standard helpers (dev convenience):
  // - OTEL_EXPORTER=console => OTEL_TRACES_EXPORTER=console
  if (process.env.OTEL_EXPORTER && !process.env.OTEL_TRACES_EXPORTER) {
    process.env.OTEL_TRACES_EXPORTER = process.env.OTEL_EXPORTER;
  }
  // - OTEL_SAMPLING_RATIO => traceidratio sampler
  if (process.env.OTEL_SAMPLING_RATIO && !process.env.OTEL_TRACES_SAMPLER) {
    process.env.OTEL_TRACES_SAMPLER = "traceidratio";
  }
  if (process.env.OTEL_SAMPLING_RATIO && !process.env.OTEL_TRACES_SAMPLER_ARG) {
    process.env.OTEL_TRACES_SAMPLER_ARG = process.env.OTEL_SAMPLING_RATIO;
  }

  // Validate header format early (optional)
  void parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

  const sdk = new NodeSDK({
    // Exporterは環境変数 (OTEL_TRACES_EXPORTER 等) に委譲
    instrumentations: [getNodeAutoInstrumentations()],
  });

  // Start ASAP. NodeSDK@0.55 は start() が同期関数。
  try {
    sdk.start();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[otel] failed to start NodeSDK", err);
  }

  // Ensure graceful shutdown on process end
  process.on("SIGTERM", () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}
