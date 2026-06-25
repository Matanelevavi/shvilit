"""טיפוסי בקשה/תגובה ל-API."""
from typing import Literal, Optional
from pydantic import BaseModel, Field

Style = Literal["historical", "mystery", "kids"]


class GenerateTourRequest(BaseModel):
    location: str = Field(..., min_length=1, description="שם המקום, למשל 'רבבה'")
    duration_minutes: int = Field(..., ge=1, le=15)
    style: Style = "historical"


class TourStatus(BaseModel):
    id: str
    status: Literal["processing", "completed", "failed"]
    location: str
    duration_minutes: int
    style: str
    video_url: Optional[str] = None
    error: Optional[str] = None
