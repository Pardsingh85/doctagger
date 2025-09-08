import azure.functions as func
from daemon_worker import run_daemon

app = func.FunctionApp()

# Every 10 minutes (CRON: second minute hour day month dayOfWeek)
@app.schedule(schedule="0 */10 * * * *", arg_name="myTimer", run_on_startup=False, use_monitor=True)
def daemon_tick(myTimer: func.TimerRequest) -> None:
    run_daemon()
