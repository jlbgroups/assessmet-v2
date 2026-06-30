from typing import Dict

class MetricsManager:
    def __init__(self):
        self.gauges: Dict[str, float] = {}
        self.counters: Dict[str, int] = {}
    
    def set_gauge(self, name: str, value: float):
        self.gauges[name] = value

    def inc_counter(self, name: str, amount: int = 1):
        self.counters[name] = self.counters.get(name, 0) + amount

    def get_prometheus_exposition(self) -> str:
        lines = []
        for name, val in self.gauges.items():
            lines.append(f"# HELP {name} Gauge metric")
            lines.append(f"# TYPE {name} gauge")
            lines.append(f"{name} {val}")
        for name, val in self.counters.items():
            lines.append(f"# HELP {name} Counter metric")
            lines.append(f"# TYPE {name} counter")
            lines.append(f"{name} {val}")
        return "\n".join(lines) + "\n"

metrics_manager = MetricsManager()
