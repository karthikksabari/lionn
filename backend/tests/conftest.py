"""
pytest configuration and fixtures for backend tests.
Ensures proper test isolation and state management.
"""

import pytest
from typing import Generator
from backend.api.app import STATE


@pytest.fixture(autouse=True)
def reset_state() -> Generator[None, None, None]:
    """Reset global STATE before and after each test."""
    initial = {"scaler": None, "models": {}, "raw": None}
    STATE.clear()
    STATE.update(initial)
    yield
    STATE.clear()
    STATE.update(initial)


@pytest.fixture
def sample_predict_request() -> dict:
    """Sample prediction request."""
    return {
        'c_rate': 1.5,
        'temperature': 25.0,
        'n_cycles': 100,
    }


@pytest.fixture
def sample_predict_response() -> dict:
    """Sample prediction response."""
    return {
        'cycles': [0, 25, 50, 75, 100],
        'baseline_a': [1.0, 0.95, 0.85, 0.70, 0.50],
        'pinn': [1.0, 0.94, 0.83, 0.68, 0.48],
        'real': [1.0, 0.93, 0.82, 0.67, 0.45],
        'metrics': {
            'baseline_a': {'mae': 0.042, 'rmse': 0.055},
            'pinn': {'mae': 0.028, 'rmse': 0.038},
        },
        'violations': {
            'baseline_a': 0,
            'pinn': 0,
        },
        'ground_truth_type': 'simulated',
    }
