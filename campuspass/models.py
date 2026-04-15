from dataclasses import dataclass, field
from campuspass.exceptions import DuplicateBookingError, InvalidBookingError, SoldOutError

@dataclass
class TicketTier:
    name: str
    price: float
    capacity: int
    _sold: int = field(init=False, repr=False)

    def __post_init__(self):
        self._sold = 0

    @property
    def remaining(self):
        return self.capacity - self._sold

    def reserve(self, quantity):
        raw_quantity = quantity
        try:
            quantity = int(quantity)
        except (TypeError, ValueError) as exc:
            raise InvalidBookingError(field="quantity", value=raw_quantity, reason="must be a valid integer") from exc
        if quantity <= 0:
            raise InvalidBookingError(field="quantity", value=quantity, reason="must be positive")
        if quantity > self.remaining:
            raise SoldOutError(event_name="Unknown event", tier_name=self.name, requested=quantity, remaining=self.remaining)
        self._sold += quantity

    def release(self, quantity):
        raw_quantity = quantity
        try:
            quantity = int(quantity)
        except (TypeError, ValueError) as exc:
            raise InvalidBookingError(field="quantity", value=raw_quantity, reason="must be a valid integer") from exc

        if quantity <= 0:
            raise InvalidBookingError(field="quantity", value=quantity, reason="must be positive")

        if quantity > self._sold:
            raise InvalidBookingError(
                field="quantity",
                value=quantity,
                reason="cannot release more tickets than currently reserved",
            )

        self._sold -= quantity


@dataclass
class Event:
    event_id: str
    name: str
    date: str
    location: str
    description: str
    tiers: dict[str, TicketTier]
    _booked_emails: set[str] = field(init=False, repr=False)

    def __post_init__(self):
        self._booked_emails = set()

    def book(self, email, tier_id, quantity):
        if tier_id not in self.tiers:
            raise InvalidBookingError(field="tier_id", value=tier_id, reason="does not match any available ticket tier")
        if email in self._booked_emails:
            raise DuplicateBookingError(email=email, event_name=self.name)
        tier = self.tiers[tier_id]
        try:
            tier.reserve(quantity)
        except SoldOutError:
            raise SoldOutError(event_name=self.name, tier_name=tier.name, requested=int(quantity), remaining=tier.remaining) from None
        self._booked_emails.add(email)

    def unbook(self, email):
        self._booked_emails.discard(email)
