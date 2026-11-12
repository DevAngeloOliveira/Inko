from collections import OrderedDict
from dataclasses import dataclass
from math import ceil


@dataclass(slots=True)
class Bucket:
    rate: int
    burst: int
    tokens: float
    updated: float

    @classmethod
    def full(cls, rate, burst, now):
        return cls(rate, burst, burst, now)

    def refill(self, now):
        self.tokens = min(self.burst, self.tokens + (now - self.updated) * self.rate)
        self.updated = now

    @property
    def retry_after(self):
        return max(1, ceil((1 - self.tokens) / self.rate))


class RateLimiter:
    def __init__(self, settings, now):
        self.settings = settings
        self.global_bucket = Bucket.full(settings.global_rate, settings.global_burst, now)
        self.overflow = Bucket.full(settings.overflow_rate, settings.overflow_burst, now)
        self.clients = OrderedDict()

    def check(self, peer, now):
        self.global_bucket.refill(now)
        while self.clients and now - next(iter(self.clients.values())).updated >= self.settings.client_ttl:
            self.clients.popitem(last=False)

        scope = "client"
        client = self.clients.get(peer)
        if client is not None:
            self.clients.move_to_end(peer)
        elif peer is None or len(self.clients) >= self.settings.client_limit:
            scope, client = "overflow", self.overflow
        elif self.global_bucket.tokens >= 1:
            client = Bucket.full(self.settings.client_rate, self.settings.client_burst, now)
            self.clients[peer] = client

        if client is not None:
            client.refill(now)
        if self.global_bucket.tokens < 1:
            delay = max(self.global_bucket.retry_after, client.retry_after) if client is not None else self.global_bucket.retry_after
            return "global", delay
        if client.tokens < 1:
            return scope, client.retry_after
        self.global_bucket.tokens -= 1
        client.tokens -= 1
        return None


class CircuitBreaker:
    def __init__(self, settings):
        self.settings = settings
        self.state = "closed"
        self.generation = 0
        self.failures = 0
        self.until = 0.0

    def permit(self, now):
        if self.state == "half_open" or self.state == "open" and now < self.until:
            return None
        if self.state == "open":
            self._transition("half_open")
        return self.generation

    def retry_after(self, now):
        return max(1, ceil(self.until - now)) if self.state == "open" else None

    def finish(self, permit, outcome, now):
        if permit != self.generation:
            return
        if outcome == "success":
            self.failures = 0
            if self.state == "half_open":
                self._transition("closed")
        elif self.state == "half_open":
            cooldown = self.settings.breaker_neutral_cooldown if outcome == "neutral" else self.settings.breaker_cooldown
            self._open(now, cooldown)
        elif outcome == "failure":
            self.failures += 1
            if self.failures >= self.settings.breaker_failures:
                self._open(now, self.settings.breaker_cooldown)

    def _open(self, now, cooldown):
        self.until = now + cooldown
        self._transition("open")

    def _transition(self, state):
        self.state = state
        self.generation += 1
