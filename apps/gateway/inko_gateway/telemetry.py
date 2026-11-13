import json
import logging

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram, ProcessCollector

from .resilience import Bucket


REQUEST_LOG = logging.getLogger("uvicorn.error.inko_gateway")


class GatewayMetrics:
    def __init__(self):
        self.registry = CollectorRegistry()
        ProcessCollector(registry=self.registry)
        options = {"registry": self.registry, "namespace": "inko_gateway"}
        buckets = (0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5)
        self.requests = Counter("requests_total", "Requests completed", ("route_id", "method", "status_class"), **options)
        self.duration = Histogram("request_duration_seconds", "Request duration", ("route_id",), buckets=buckets, **options)
        self.inflight = Gauge("inflight", "Admitted requests", ("plane",), **options)
        self.upstream_inflight = Gauge("upstream_inflight", "Upstream attempts in progress", ("service", "plane"), **options)
        self.admitted = Counter("admitted_total", "Business requests admitted", **options)
        self.admission_rejections = Counter("admission_rejections_total", "Requests rejected by capacity", ("service", "reason"), **options)
        self.rate_rejections = Counter("rate_rejections_total", "Requests rejected by quota", ("scope",), **options)
        self.attempts = Counter("upstream_attempts_total", "Upstream attempts started", ("service", "plane"), **options)
        self.upstream_duration = Histogram("upstream_duration_seconds", "Upstream attempt duration", ("service", "plane"), buckets=buckets, **options)
        self.pool_timeouts = Counter("pool_timeouts_total", "HTTP client pool timeouts", ("service", "plane"), **options)
        self.circuit_state = Gauge("circuit_state", "Circuit state: 0 closed, 1 open, 2 half-open", ("service",), **options)
        self.circuit_transitions = Counter("circuit_transitions_total", "Circuit transitions", ("service", "to_state"), **options)
        self.snapshot_age = Gauge("status_snapshot_age_seconds", "Age of last complete status snapshot", **options)
        self.event_loop_lag = Gauge("event_loop_lag_seconds", "Last snapshot scheduler wakeup delay", **options)
        self.client_buckets = Gauge("client_buckets", "Allocated rate limit client buckets", **options)
        self.payload_rejections = Counter("payload_rejections_total", "Payload rejected", ("direction", "reason"), **options)
        self.success_sample = 0
        self.error_log_bucket = None

    def record_request(self, route_id, method, status_class, started, completed):
        duration = max(0.0, completed - started)
        self.requests.labels(route_id, method, status_class).inc()
        self.duration.labels(route_id).observe(duration)
        if status_class in ("2xx", "3xx"):
            self.success_sample = (self.success_sample + 1) % 256
            if self.success_sample != 0:
                return
            level = logging.INFO
        else:
            if self.error_log_bucket is None:
                self.error_log_bucket = Bucket.full(4, 8, completed)
            self.error_log_bucket.refill(completed)
            if self.error_log_bucket.tokens < 1:
                return
            self.error_log_bucket.tokens -= 1
            level = logging.WARNING
        REQUEST_LOG.log(level, "%s", json.dumps({
            "event": "gateway_request", "route": route_id, "method": method,
            "statusClass": status_class, "durationMs": round(duration * 1000, 2),
        }, separators=(",", ":")))

    def observe_breaker(self, service, previous, current):
        self.circuit_state.labels(service).set({"closed": 0, "open": 1, "half_open": 2}[current])
        if previous != current:
            self.circuit_transitions.labels(service, current).inc()
