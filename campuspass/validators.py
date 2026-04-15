from dataclasses import dataclass
from campuspass.exceptions import InvalidBookingError


@dataclass
class BookingRequest:
    email: str
    tier_name: str
    quantity: int


def parse_booking_request(data: dict) -> BookingRequest:
    try:
        email_raw = data["email"]
    except KeyError as exc:
        raise InvalidBookingError(field="email", value=None, reason="field is required") from exc

    try:
        tier_raw = data["tier_name"]
    except KeyError as exc:
        raise InvalidBookingError(field="tier_name", value=None, reason="field is required") from exc

    try:
        quantity_raw = data["quantity"]
    except KeyError as exc:
        raise InvalidBookingError(field="quantity", value=None, reason="field is required") from exc

    try:
        email = str(email_raw).strip().lower()
    except Exception as exc:
        raise InvalidBookingError(field="email", value=email_raw, reason="must be text") from exc

    try:
        tier_name = str(tier_raw).strip()
    except Exception as exc:
        raise InvalidBookingError(field="tier_name", value=tier_raw, reason="must be text") from exc

    try:
        quantity = int(quantity_raw)
    except (TypeError, ValueError) as exc:
        raise InvalidBookingError(field="quantity", value=quantity_raw, reason="must be a valid integer") from exc

    if not email:
        raise InvalidBookingError(field="email", value=email_raw, reason="cannot be empty")

    if "@" not in email:
        raise InvalidBookingError(field="email", value=email_raw, reason="must contain '@'")

    if not tier_name:
        raise InvalidBookingError(field="tier_name", value=tier_raw, reason="cannot be empty")

    if quantity <= 0:
        raise InvalidBookingError(field="quantity", value=quantity, reason="must be positive")

    return BookingRequest(email=email, tier_name=tier_name, quantity=quantity)
