import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
// Logs (OTLP/HTTP)
import { logs as logsAPI } from "@opentelemetry/api-logs";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
// Bun/NodeのCJS/ESM差異でnamed exportが解決できない環境があるため
// 名前空間importに変更して互換性を確保する
import * as resources from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
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
      if (k) {
        // decodeURIComponent may throw on malformed percent-encoding.
        // Only guard the decode call; on failure, fall back to the raw value
        // so other headers remain usable. Do not rethrow.
        try {
          acc[k] = decodeURIComponent(v);
        } catch {
          acc[k] = v; // fallback: keep raw (undecoded) value
        }
      }
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

  // Metrics exporter selection (prefer explicit env)
  const metricsExporters = (process.env.OTEL_METRICS_EXPORTER || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const prometheusEnabled =
    process.env.PROMETHEUS_ENABLED === "true" ||
    metricsExporters.includes("prometheus");
  const otlpMetricsEnabled = metricsExporters.includes("otlp");

  // Build OTLP Metrics config when enabled (Grafana Cloud compatible)
  const otlpBase =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
  const metricsUrl =
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
    `${otlpBase.replace(/\/$/, "")}/v1/metrics`;
  const commonHeaders = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  const exportInterval = process.env.OTEL_METRIC_EXPORT_INTERVAL
    ? Number(process.env.OTEL_METRIC_EXPORT_INTERVAL)
    : undefined;

  // Logs exporter selection (explicit only; default is disabled)
  const logsExporters = (process.env.OTEL_LOGS_EXPORTER || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const otlpLogsEnabled = logsExporters.includes("otlp");
  const consoleLogsEnabled = logsExporters.includes("console");

  // Initialize Logs pipeline before SDK.start() so console instrumentation sees the provider
  let logProvider: LoggerProvider | undefined;
  if (otlpLogsEnabled || consoleLogsEnabled) {
    // Align Logs resource with env-provided attributes (service.name, etc.).
    // Note: NodeSDK applies env detectors to Traces/Metrics; we mirror the
    // important bits here for Logs without adding detector deps.
    const attrsRaw = process.env.OTEL_RESOURCE_ATTRIBUTES || "";
    const envResourceAttrs = parseHeaders(attrsRaw);
    const resourceFromEnv = resources.resourceFromAttributes(envResourceAttrs);

    // Fallback service.name if not provided via env; keep stable for local dev
    const defaultServiceName =
      process.env.OTEL_SERVICE_NAME ||
      process.env.npm_package_name ||
      "moto-weather-index";
    const resource = resourceFromEnv.merge(
      resources.resourceFromAttributes({
        "service.name":
          (resourceFromEnv.attributes["service.name"] as string) ||
          defaultServiceName,
      }),
    );

    logProvider = new LoggerProvider({ resource });
    if (otlpLogsEnabled) {
      const logsUrl =
        process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
        `${otlpBase.replace(/\/$/, "")}/v1/logs`;
      logProvider.addLogRecordProcessor(
        new BatchLogRecordProcessor(
          new OTLPLogExporter({ url: logsUrl, headers: commonHeaders }),
        ),
      );
      // eslint-disable-next-line no-console
      console.info("[otel] logs exporter enabled: otlp", {
        url: logsUrl,
        headers: Object.keys(commonHeaders ?? {}),
        resourceAttrs: resource.attributes,
      });
    }
    if (consoleLogsEnabled) {
      logProvider.addLogRecordProcessor(
        new BatchLogRecordProcessor(new ConsoleLogRecordExporter()),
      );
      // eslint-disable-next-line no-console
      console.info("[otel] logs exporter enabled: console");
    }
    logsAPI.setGlobalLoggerProvider(logProvider);
  } else {
    // eslint-disable-next-line no-console
    console.info(
      "[otel] logs exporter disabled (set OTEL_LOGS_EXPORTER=otlp|console to enable)",
    );
  }

  const sdk = new NodeSDK({
    // Exporterは環境変数 (OTEL_TRACES_EXPORTER 等) に委譲（トレース）
    instrumentations: [
      getNodeAutoInstrumentations({
        // Ensure console logs are captured as LogRecords (for OTLP Logs)
        "@opentelemetry/instrumentation-console": { enabled: true } as any,
      }),
    ],
    ...(prometheusEnabled
      ? {
          metricReader: new PrometheusExporter({
            host: process.env.OTEL_EXPORTER_PROMETHEUS_HOST as any,
            port: process.env.OTEL_EXPORTER_PROMETHEUS_PORT
              ? Number(process.env.OTEL_EXPORTER_PROMETHEUS_PORT)
              : undefined,
            endpoint: process.env.OTEL_EXPORTER_PROMETHEUS_ENDPOINT as any,
          }),
        }
      : otlpMetricsEnabled
        ? {
            metricReader: new PeriodicExportingMetricReader({
              exporter: new OTLPMetricExporter({
                url: metricsUrl,
                headers: commonHeaders,
              }),
              ...(exportInterval
                ? { exportIntervalMillis: exportInterval }
                : {}),
            }),
          }
        : {}),
  });

  // Start ASAP. NodeSDK@0.55 は start() が同期関数。
  try {
    sdk.start();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[otel] failed to start NodeSDK", err);
  }

  // Ensure graceful shutdown on process end
  process.once("SIGTERM", () => {
    Promise.all([
      sdk.shutdown().catch(() => undefined),
      logProvider?.shutdown?.().catch(() => undefined),
    ]).finally(() => process.exit(0));
  });
}
