# Hugging Face Spaces (Docker) - backend הפקת וידאו/אודיו/חידונים של שבילית.
FROM python:3.12-slim

# FFmpeg נדרש לרינדור הווידאו ולמדידת אורך האודיו.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# HF Spaces מריץ כמשתמש לא-root; תיקיות האחסון חייבות להיות ניתנות לכתיבה.
RUN mkdir -p /app/storage/videos /app/storage/audio /app/storage/tmp \
    && chmod -R 777 /app/storage

# ffmpeg/ffprobe נמצאים ב-PATH בתוך הקונטיינר.
ENV FFMPEG_BIN=ffmpeg \
    FFPROBE_BIN=ffprobe

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
