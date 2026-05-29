from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    worker_api_key: str = "change-me-shared-secret"
    model_weights: str = "weights/best.pt"
    model_version: str = "yolov8n-obb-dota"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    log_level: str = "info"

    # Detection knobs
    conf_threshold: float = 0.35
    iou_threshold: float = 0.5
    max_detections: int = 100


settings = Settings()
