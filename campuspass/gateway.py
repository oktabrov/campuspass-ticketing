from datetime import datetime, timezone
from campuspass.exceptions import PaymentDeclinedError


class CampusPayGateway:
    def charge(self, amount, token):
        token_text = "" if token is None else str(token)

        if token_text.startswith("tok_valid"):
            reference = f"cp_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
            return {"reference": reference, "amount": amount}

        if token_text.startswith("tok_decline"):
            raise PaymentDeclinedError(gateway_name="CampusPay", reason="card declined")

        if token_text.startswith("tok_error"):
            raise ConnectionError("CampusPay gateway is unavailable")

        raise PaymentDeclinedError(gateway_name="CampusPay", reason="invalid token")