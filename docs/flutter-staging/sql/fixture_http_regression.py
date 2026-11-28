"""HTTP regression against a disposable localhost PostgREST instance only."""
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:3100"
GEN = "33333333-3333-4333-8333-333333333333"
OWNER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
COLLECTOR = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
FOREIGN = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
SECRET = os.environ["FIXTURE_JWT_SECRET"].encode()

def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def token(actor=OWNER, active=True, expired=False):
    header = b64(b'{"alg":"HS256","typ":"JWT"}')
    claims = b64(json.dumps({
        "role": "authenticated", "sub": actor,
        "fixtureAccess": "active" if active else "expired",
        "exp": int(time.time()) + (-60 if expired else 600),
    }).encode())
    body = f"{header}.{claims}"
    sig = b64(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"

def rpc(op, command, *, jwt=None, authenticated=True, epoch="0", ok=True):
    headers = {"Content-Type": "application/json"}
    if authenticated:
        headers["Authorization"] = "Bearer " + (jwt or token())
    if epoch is not None:
        headers["x-moldatk-sync-epoch"] = epoch
    req = urllib.request.Request(
        BASE + "/rpc/flutter_stage_" + op + "_v1",
        data=json.dumps({"p_command": command, "p_expected_epoch": 0}).encode(),
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            value = json.load(response)
    except urllib.error.HTTPError as exc:
        if ok:
            raise AssertionError(f"{op} failed: {exc.code} {exc.read().decode()}") from exc
        body = exc.read().decode()
        assert 400 <= exc.code < 500, (op, exc.code, body)
        return exc.code
    if not ok:
        raise AssertionError(f"{op} unexpectedly succeeded")
    return value

def db(query):
    assert os.environ.get("PGDATABASE") == "moldatk_fixture"
    return subprocess.check_output(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query],
        text=True,
    ).strip()

def version(sid):
    return json.loads(db(
        "select to_jsonb(updated_at) from generator_subscribers "
        f"where generator_id='{GEN}' and id='{sid}'"
    ))

def rid():
    return str(uuid.uuid4())

def main():
    for _ in range(40):
        try:
            with urllib.request.urlopen(BASE + "/", timeout=2):
                break
        except (OSError, urllib.error.URLError):
            time.sleep(1)
    else:
        raise RuntimeError("Fixture REST server unavailable")
    create = {
        "requestId": rid(), "fullName": "HTTP fixture", "code": None,
        "phone": "", "tierId": "normal", "lineId": "http-a",
        "amperes": 10, "discountAmperes": 2, "debtMode": "prior",
        "priorMonth": "2026-10", "expectedCurrentMonth": "2026-11",
        "expectedDebtIqd": 85000,
    }
    rpc("create_subscriber", create, authenticated=False, ok=False)
    rpc("create_subscriber", create, jwt=token(expired=True), ok=False)
    assert rpc("create_subscriber", create, jwt=token(COLLECTOR), ok=False) == 403
    rpc("create_subscriber", create, jwt=token(active=False), ok=False)
    rpc("create_subscriber", create, epoch=None, ok=False)
    first = rpc("create_subscriber", create)
    sid = first["subscriberId"]
    assert first["amountDueIqd"] == 85000
    assert rpc("create_subscriber", create)["replayed"] is True
    profile = {
        "requestId": rid(), "subscriberId": sid, "fullName": "Edited HTTP",
        "phone": "", "expectedUpdatedAt": version(sid),
    }
    assert rpc("edit_subscriber_profile", profile, jwt=token(FOREIGN), ok=False) == 403
    assert rpc("edit_subscriber_profile", profile)["ok"] is True
    move = {
        "requestId": rid(), "subscriberId": sid, "lineId": "http-b",
        "expectedUpdatedAt": version(sid),
    }
    assert rpc("move_subscriber_line", move)["ok"] is True
    ledger = json.loads(db(
        "select jsonb_agg(jsonb_build_object('id',id,'month',month_id,"
        "'status',status,'total',total_amount,'paid',paid_amount,"
        "'remaining',remaining_amount) order by month_id,id) from generator_invoices "
        f"where generator_id='{GEN}' and subscriber_id='{sid}'"
    ))
    payment = {
        "requestId": rid(), "subscriberId": sid, "expectedUpdatedAt": version(sid),
        "expectedMonth": "2026-11", "expectedLedger": ledger, "amountIqd": 45000,
    }
    assert rpc("payment_status", payment)["state"] == "unconfirmed"
    assert rpc("collect_payment", payment, jwt=token(COLLECTOR), ok=False) == 403
    assert rpc("collect_payment", payment, jwt=token(FOREIGN), ok=False) == 403
    # Concurrent retry of the identical immutable command must charge once.
    with ThreadPoolExecutor(max_workers=2) as pool:
        receipts = list(pool.map(lambda _: rpc("collect_payment", payment), range(2)))
    assert sorted(r["replayed"] for r in receipts) == [False, True]
    assert receipts[0]["paymentId"] == receipts[1]["paymentId"]
    receipt = receipts[0]
    assert receipt["debtAfter"] == 40000
    assert db(f"select count(*) from generator_payments where generator_id='{GEN}'") == "1"
    assert db(f"select sum(amount) from generator_cashbox_entries where generator_id='{GEN}'") == "45000"
    assert receipt["printData"]["subscriberName"] == "Edited HTTP"
    assert rpc("collect_payment", payment)["replayed"] is True
    assert rpc("payment_status", payment)["state"] == "committed"
    reversal = {
        "requestId": rid(), "paymentId": receipt["paymentId"],
        "reason": "HTTP fixture reversal", "expectedUpdatedAt": version(sid),
    }
    assert rpc("reverse_payment", reversal, jwt=token(COLLECTOR), ok=False) == 403
    assert rpc("reverse_payment", reversal)["debtAfter"] == 85000
    assert rpc("reverse_payment", reversal)["replayed"] is True
    assert rpc("payment_status", payment)["state"] == "reversed"
    assert db(f"select count(*) from generator_payments where generator_id='{GEN}'") == "1"
    assert db(f"select sum(amount) from generator_cashbox_entries where generator_id='{GEN}'") == "0"
    assert db(f"select count(*) from generator_subscribers where generator_id='{GEN}'") == "1"
    print("PASS: six HTTP RPCs, JWT signature and expiry boundary, role, tenant, epoch, replay and cashbox reversal")

if __name__ == "__main__":
    main()
