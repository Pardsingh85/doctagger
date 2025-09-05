import logging
import azure.functions as func
from daemon_worker import run_daemon

def main(mytimer: func.TimerRequest) -> None:
    logging.info("✅ Azure Timer Trigger fired.")
    try:
        run_daemon()
        logging.info("✅ Daemon ran successfully.")
    except Exception as e:
        logging.error(f"❌ Daemon failed: {e}", exc_info=True)
