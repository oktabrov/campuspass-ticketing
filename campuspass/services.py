from campuspass.exceptions import PaymentDeclinedError, PaymentError
from campuspass.validators import parse_booking_request


class CheckoutService:
    def __init__(self, gateway=None):
        self.gateway = gateway

    def checkout(self, event, email, tier_name, quantity, payment_token):
        booking_request = parse_booking_request(
            {
                "email": email,
                "tier_name": tier_name,
                "quantity": quantity,
            }
        )

        event.book(booking_request.email, booking_request.tier_name, booking_request.quantity)

        tier = event.tiers[booking_request.tier_name]
        total_price = float(tier.price) * booking_request.quantity

        payment_reference = None
        if self.gateway is not None and total_price > 0:
            try:
                payment_result = self.gateway.charge(total_price, payment_token)
                payment_reference = payment_result.get("reference")
            except PaymentDeclinedError:
                tier.release(booking_request.quantity)
                event.unbook(booking_request.email)
                raise
            except ConnectionError as exc:
                tier.release(booking_request.quantity)
                event.unbook(booking_request.email)
                raise PaymentError("Payment gateway is currently unavailable.") from exc

        summary = {
            "email": booking_request.email,
            "event_id": event.event_id,
            "event_name": event.name,
            "tier": booking_request.tier_name,
            "quantity": booking_request.quantity,
            "total_price": total_price,
        }
        if payment_reference is not None:
            summary["payment_reference"] = payment_reference

        return summary
