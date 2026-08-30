import json
from pathlib import Path
from fastapi import APIRouter

training_history_router = APIRouter()

HISTORY_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "training_history.json"


@training_history_router.get("/training-history")
def get_training_history():
    if HISTORY_PATH.exists():
        try:
            with open(HISTORY_PATH, "r") as f:
                data = json.load(f)
            return data
        except Exception as exc:
            return {"message": f"Error reading training history: {exc}"}
    else:
        return {"message": "No training history found. Re-run train.py to generate."}


# Register this router in app.py with: app.include_router(training_history_router)
