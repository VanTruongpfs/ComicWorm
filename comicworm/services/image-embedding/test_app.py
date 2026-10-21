from io import BytesIO
from unittest.mock import Mock

from fastapi.testclient import TestClient
import numpy as np
from PIL import Image
import pytest

from app import create_app, DIMENSIONS, MAX_BYTES, MODEL_NAME


@pytest.fixture
def client():
    encoder = Mock()
    encoder.encode.return_value = np.arange(1, DIMENSIONS + 1, dtype=float)
    with TestClient(create_app(lambda: encoder)) as connection:
        yield connection, encoder


def image_bytes(format="PNG", mode="RGBA"):
    buffer = BytesIO()
    Image.new(mode, (32, 48), "white").save(buffer, format=format)
    return buffer.getvalue()


def test_normalizes_vector_and_converts_image_to_rgb(client):
    connection, encoder = client
    response = connection.post("/embed", content=image_bytes())
    assert response.status_code == 200
    assert response.json()["modelName"] == MODEL_NAME
    assert len(response.json()["embedding"]) == DIMENSIONS
    assert np.linalg.norm(response.json()["embedding"]) == pytest.approx(1)
    assert encoder.encode.call_args.args[0].mode == "RGB"


@pytest.mark.parametrize("body", [b"", b"not an image", b"<svg></svg>", b"\x89PNG\r\n\x1a\n"])
def test_rejects_invalid_images_before_encoding(client, body):
    connection, encoder = client
    assert connection.post("/embed", content=body).status_code == 400
    encoder.encode.assert_not_called()


def test_rejects_oversized_payload(client):
    connection, encoder = client
    assert connection.post("/embed", content=b"x" * (MAX_BYTES + 1)).status_code == 413
    encoder.encode.assert_not_called()


def test_rejects_unsupported_format(client):
    connection, encoder = client
    assert connection.post("/embed", content=image_bytes("BMP", "RGB")).status_code == 415
    encoder.encode.assert_not_called()


def test_encodes_first_frame_of_gif(client):
    connection, encoder = client
    assert connection.post("/embed", content=image_bytes("GIF", "RGB")).status_code == 200
    encoder.encode.assert_called_once()


def test_health_reports_model_identity(client):
    connection, _ = client
    assert connection.get("/health").json() == {
        "status": "ready", "modelName": MODEL_NAME, "dimensions": DIMENSIONS,
    }
