# function_app.py
import logging
import azure.functions as func

app = func.FunctionApp()

# --- HTTP (ping) ---
@app.route(route="ping", auth_level=func.AuthLevel.ANONYMOUS)
def ping(req: func.HttpRequest):
    return func.HttpResponse("ok")

# --- HTTP (run daemon on-demand; handy for LOCAL testing) ---
@app.route(route="run-daemon", auth_level=func.AuthLevel.ANONYMOUS)
def run_daemon_http(req: func.HttpRequest):
    logging.info("run-daemon HTTP invoked")
    try:
        from daemon_worker import run_daemon  # import inside to avoid cold-start cost
        run_daemon()
        return func.HttpResponse("daemon ran", status_code=200)
    except Exception as e:
        logging.exception("daemon failed")
        return func.HttpResponse(f"daemon error: {e}", status_code=500)

# --- TIMER (prod schedule unchanged) ---
@app.schedule(schedule="0 */10 * * * *", arg_name="mytimer", run_on_startup=False, use_monitor=False)
def daemon_tick(mytimer: func.TimerRequest):
    logging.info("daemon_tick invoked")
    try:
        from daemon_worker import run_daemon  # import INSIDE
        run_daemon()
        logging.info("daemon run completed")
    except Exception:
        logging.exception("daemon run failed")
