import logging
import azure.functions as func

app = func.FunctionApp()

# --- HTTP (proof) ---
@app.route(route="ping", auth_level=func.AuthLevel.ANONYMOUS)
def ping(req: func.HttpRequest):
    return func.HttpResponse("ok")

# --- TIMER (minimal, no extras) ---
@app.schedule(schedule="0 */10 * * * *", arg_name="mytimer", run_on_startup=False, use_monitor=False)
def daemon_tick(mytimer: func.TimerRequest):
    logging.info("daemon_tick invoked")
    try:
        from daemon_worker import run_daemon  # import INSIDE
        run_daemon()
        logging.info("daemon run completed")
    except Exception:
        logging.exception("daemon run failed")