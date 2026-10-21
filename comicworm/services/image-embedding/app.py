"""Local CLIP image encoder. Spring Boot owns product access, indexing and search."""
import asyncio
from contextlib import asynccontextmanager
from io import BytesIO
import os
from threading import Lock
import warnings

from fastapi import FastAPI, HTTPException, Request
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

MODEL_REPO = "sentence-transformers/clip-ViT-B-32"
MODEL_REVISION = "f41c38369690de9493a1c5e24e750e4adc1ac430"
MODEL_NAME = "clip-vit-b32-f41c383-rgb-v1"
DIMENSIONS = 512
MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def load_encoder():
    # Imported only at startup; validation tests do not need to download model weights.
    os.environ.setdefault("USE_TF", "0")
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(
        MODEL_REPO, revision=MODEL_REVISION,
        device=os.environ.get("IMAGE_EMBEDDING_DEVICE", "cpu"), trust_remote_code=False,
    )


def decode_image(data: bytes) -> Image.Image:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                if source.format not in {"JPEG", "PNG", "WEBP", "GIF"}:
                    raise HTTPException(415, "Only JPEG, PNG, WebP and GIF are supported.")
                if source.width * source.height > MAX_PIXELS:
                    raise HTTPException(400, "Image dimensions are too large.")
                source.load()
                return ImageOps.exif_transpose(source).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as error:
        raise HTTPException(400, "Invalid or oversized image.") from error


def create_app(encoder_factory=load_encoder) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application):
        application.state.encoder = await run_in_threadpool(encoder_factory)
        application.state.lock = Lock()
        application.state.slots = asyncio.Semaphore(2)
        yield

    application = FastAPI(title="ComicWorm image embeddings", lifespan=lifespan)

    @application.get("/health")
    def health():
        return {"status": "ready", "modelName": MODEL_NAME, "dimensions": DIMENSIONS}

    def encode(data):
        image = decode_image(data)
        try:
            with application.state.lock:
                vector = application.state.encoder.encode(
                    image, normalize_embeddings=True, convert_to_numpy=True,
                    show_progress_bar=False,
                )
            vector = np.asarray(vector, dtype=np.float64)
            if vector.shape != (DIMENSIONS,) or not np.isfinite(vector).all():
                raise RuntimeError("Invalid encoder output")
            norm = np.linalg.norm(vector)
            if not np.isfinite(norm) or norm == 0:
                raise RuntimeError("Empty encoder output")
            return {"modelName": MODEL_NAME, "embedding": (vector / norm).tolist()}
        finally:
            image.close()

    @application.post("/embed")
    async def embed(request: Request):
        data = bytearray()
        async for chunk in request.stream():
            if len(data) + len(chunk) > MAX_BYTES:
                raise HTTPException(413, "Maximum image size is 5 MB.")
            data.extend(chunk)
        if not data:
            raise HTTPException(400, "Image is empty.")
        async with application.state.slots:
            return await run_in_threadpool(encode, bytes(data))

    return application


app = create_app()
