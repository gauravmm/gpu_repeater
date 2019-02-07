import atexit
import datetime
import itertools
import json as pyjson
import os
from pathlib import Path

import requests

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from flask import Flask, jsonify

CLIENT_PORT = 9212
SERVER_PORT = 8271
UPDATE_PERIOD = 60

# Get the list of other servers from the environment variable:
SERVERS = [s for s in os.environ.get("SLACK_BOT_OTHER_SERVERS").split(",") if s]

global GPU_RESPONSE
GPU_RESPONSE = {k: (None, None) for k in SERVERS}

app = Flask(__name__)
@app.route("/")
def response():
    return jsonify(GPU_RESPONSE)

BASE_PATH = Path("/home/serverbot/gpu_history/")
def update(server):
    global GPU_RESPONSE

    servertime = datetime.datetime.utcnow()
    path = BASE_PATH / "{}-{:02}".format(servertime.year, servertime.month) / "{:02}".format(servertime.day) / "{:02}-{:02}-{}.json".format(servertime.hour, (servertime.minute//5)*5, server)
    path.parent.mkdir(exist_ok=True, parents=True)

    try:
        r = requests.get('http://{}:{}'.format(server, CLIENT_PORT), timeout=0.1)

        if r.status_code == 200:
            resp = r.json()
            GPU_RESPONSE[server] = (resp, servertime)

            path.parent.mkdir(exist_ok=True, parents=True)
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
