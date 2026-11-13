import os
from dataclasses import dataclass, field
from math import isfinite
from urllib.parse import urlsplit


@dataclass(frozen=True, slots=True)
class ServicePolicy:
    name: str
    url: str
    slots: int
    keepalive: int

    def __post_init__(self):
        try:
            url = urlsplit(self.url)
            port = url.port
        except ValueError as exc:
            raise ValueError(f"Invalid origin for {self.name}") from exc
        if (
            url.scheme not in ("http", "https") or not url.hostname
            or not port or url.username is not None or url.password is not None
            or url.path not in ("", "/") or "?" in self.url or "#" in self.url
            or any(char.isspace() or ord(char) < 32 or char == "\\" for char in self.url)
        ):
            raise ValueError(f"Invalid origin for {self.name}")
        if not 0 < self.slots or not 0 < self.keepalive <= self.slots:
            raise ValueError(f"Invalid pool limits for {self.name}")


SERVICE_DEFAULTS = (
    ServicePolicy("catalogo", "http://localhost:8081", 12, 6),
    ServicePolicy("usuarios", "http://localhost:8082", 12, 6),
    ServicePolicy("circulacao", "http://localhost:8083", 8, 4),
    ServicePolicy("relatorios", "http://localhost:8084", 6, 3),
)


@dataclass(frozen=True, slots=True)
class GatewaySettings:
    services: tuple[ServicePolicy, ...] = SERVICE_DEFAULTS
    business_slots: int = 38
    control_slots: int = 6
    global_rate: int = 60
    global_burst: int = 32
    client_rate: int = 30
    client_burst: int = 16
    overflow_rate: int = 5
    overflow_burst: int = 5
    client_limit: int = 1024
    client_ttl: float = 120.0
    deadline: float = 2.0
    error_reserve: float = 0.05
    request_bytes: int = 65536
    response_bytes: int = 1048576
    connect_timeout: float = 0.25
    pool_timeout: float = 0.05
    write_timeout: float = 0.25
    read_timeout: float = 1.2
    probe_timeout: float = 1.0
    probe_interval: float = 5.0
    probe_bytes: int = 16384
    stale_after: float = 15.0
    breaker_failures: int = 5
    breaker_cooldown: float = 10.0
    breaker_neutral_cooldown: float = 1.0
    docs_enabled: bool = True

    def __post_init__(self):
        if tuple(service.name for service in self.services) != tuple(service.name for service in SERVICE_DEFAULTS):
            raise ValueError("Unexpected service registry")
        for name in self.__dataclass_fields__:
            value = getattr(self, name)
            if isinstance(value, (float, int)) and not isinstance(value, bool) and (
                not isfinite(value) or value <= 0
            ):
                raise ValueError(f"Invalid Gateway setting: {name}")
        if self.business_slots != sum(service.slots for service in self.services):
            raise ValueError("Business slots must equal the sum of service slots")
        if not self.error_reserve < self.deadline:
            raise ValueError("Error reserve must fit within the deadline")
        if not self.probe_timeout <= self.probe_interval < self.stale_after:
            raise ValueError("Invalid probe time budget")
        if self.breaker_neutral_cooldown > self.breaker_cooldown:
            raise ValueError("Invalid neutral circuit cooldown")

    @classmethod
    def from_env(cls):
        defaults = cls()
        settings = {}
        for name in cls.__dataclass_fields__:
            value = getattr(defaults, name)
            raw = os.getenv(f"INKO_GATEWAY_{name.upper()}")
            if raw is None or name == "services":
                continue
            if isinstance(value, bool):
                if raw.lower() not in ("true", "false"):
                    raise ValueError(f"Invalid Gateway setting: {name}")
                settings[name] = raw.lower() == "true"
            else:
                settings[name] = type(value)(raw)
        services = tuple(
            ServicePolicy(
                service.name,
                os.getenv(f"{service.name.upper()}_URL", service.url),
                int(os.getenv(f"INKO_GATEWAY_{service.name.upper()}_SLOTS", service.slots)),
                int(os.getenv(f"INKO_GATEWAY_{service.name.upper()}_KEEPALIVE", service.keepalive)),
            )
            for service in SERVICE_DEFAULTS
        )
        return cls(services=services, **settings)


@dataclass(frozen=True, slots=True)
class RoutePolicy:
    id: str
    path: str
    service: str | None = None


@dataclass(slots=True)
class RequestBudget:
    deadline: float
    dispatched: bool = field(init=False, default=False)

    def consume_attempt(self):
        if self.dispatched:
            raise RuntimeError("Upstream attempt already consumed")
        self.dispatched = True
