import atexit
import datetime
import itertools
import json as pyjson
import logging
import os
from pathlib import Path

import requests

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from flask import Flask, jsonify

logger = logging.getLogger("repeater")

CLIENT_PORT = 9212
SERVER_PORT = 8271
UPDATE_PERIOD = 60

# Get the list of other servers from the environment variable:
SERVERS = [s for s in os.environ.get("SLACK_BOT_OTHER_SERVERS").split(",") if s]
USERS = [s.split(":")[0] for s in os.environ.get("SLACK_BOT_USERS_LOOKUP").split(",") if s]

global GPU_RESPONSE
GPU_RESPONSE = {k: (None, None) for k in SERVERS}

app = Flask(__name__)
@app.route("/")
def response():
    return jsonify(GPU_RESPONSE)

#
# History
#
global GPU_HISTORY, GPU_ID
GPU_HISTORY = []
GPU_ID = {s: set() for s in SERVERS}

def round_time(ts):
    return datetime.datetime(ts.year, ts.month, ts.day, ts.hour, (ts.minute // 5) * 5)

def history_path(ts, server):
    ts = round_time(ts)
    return BASE_PATH / "{}-{:02}".format(ts.year, ts.month) / "{:02}".format(ts.day) / "{:02}-{:02}-{}.json".format(ts.hour, ts.minute, server)

# machines: List[Machine, List[GPU]]
# values: Tuple[Time, Dict[GPU, List[Tuple[User, MemoryFraction, CMD]]]]
def update_history():
    global GPU_HISTORY, GPU_ID

    servertime = datetime.datetime.utcnow()
    ts = earliest_ts = round_time(servertime - datetime.timedelta(days=1))
    if len(GPU_HISTORY):
        ts = max(earliest_ts, GPU_HISTORY[-2][0] + datetime.timedelta(minutes=5))

    while ts < servertime:
        # Assmble the row corresponding to ts:
        row = {}
        for server in SERVERS:
            path = history_path(ts, server)
            try:
                data = pyjson.loads(path.read_text())
            except FileNotFoundError as e:
                logger.warn("Cannot find {}".format(e.filename))
                continue
            except OSError as e:
                logger.exception(e)
                continue # Skip if file does not exist.

            if data["error"]:
                continue

            for gpu, state in data["state"].items():
                GPU_ID[server].add(gpu)
                # Size of total memory, in bytes.
                total_mem_used_frac = state["gpu_mem"]["used"]
                total_mem_bytes = sum(s["gpu_mem"] for s in state["gpu_procs"])

                # Hack for divide-by-zeros:
                if total_mem_bytes <= 0:
                    total_mem_bytes = 1

                row[gpu] = sorted((s["username"], s["pid"], s["create_time"], s["gpu_mem"]/total_mem_bytes * total_mem_used_frac, " ".join(s["cmdline"]).strip()) for s in state["gpu_procs"])

        GPU_HISTORY.append((ts, row))
        ts += datetime.timedelta(minutes=5)

    rv_hist = sorted((ts, row) for ts, row in GPU_HISTORY if ts >= earliest_ts)
    GPU_HISTORY = rv_hist[:-1]
    return rv_hist, GPU_ID


@app.route("/history")
def history():
    gpu_hist, gpu_ids = update_history()
    return jsonify({"users": USERS, "gpus" : {k: list(v) for k, v in gpu_ids.items()}, "history" : gpu_hist})


BASE_PATH = Path("/home/serverbot/gpu_history/")
def update(server):
    global GPU_RESPONSE

    servertime = datetime.datetime.utcnow()
    path = history_path(servertime, server)
    path.parent.mkdir(exist_ok=True, parents=True)

    try:
        r = requests.get('http://{}:{}'.format(server, CLIENT_PORT), timeout=0.1)

        if r.status_code == 200:
            resp = r.json()
            GPU_RESPONSE[server] = (resp, servertime)

            with path.open('w') as handle:
                pyjson.dump({"error":None, "state":resp}, handle)

    except Exception as e:
        now = None
        if server in GPU_RESPONSE:
            _, now = GPU_RESPONSE[server]
        GPU_RESPONSE[server] = (str(e), now)
        with path.open('w') as handle:
            pyjson.dump({"error":str(e), "state":None}, handle)

        return

def main():
    assert SERVERS
    # Bootstrap:
    for s in SERVERS:
        update(s)
    update_history()

    NEXT_SERVER = itertools.cycle(SERVERS)

    scheduler = BackgroundScheduler()
    scheduler.start()
    scheduler.add_job(
        func=lambda: update(next(NEXT_SERVER)),
        trigger=IntervalTrigger(seconds=UPDATE_PERIOD//len(SERVERS)),
        id='update_server',
        name='Query the server for running jobs',
        replace_existing=True)
    # Shut down the scheduler when exiting the app
    atexit.register(lambda: scheduler.shutdown())

    app.run(host='0.0.0.0', port=SERVER_PORT)

if __name__ == "__main__":
    main()
