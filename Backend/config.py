from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    # env_ignore_empty: a copied .env.example (all names, blank values) falls back to
    # these defaults instead of failing to parse "" as a bool or int.
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", case_sensitive=True, extra="ignore", env_ignore_empty=True
    )

    ENV: str = "development"
    # Neon needs `?sslmode=require` in the URL; the local cluster does not.
    DATABASE_URL: str

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    FRONTEND_ORIGIN: str = "http://localhost:3000"
    COOKIE_SECURE: bool = False
    # Behind Vercel + Render every request comes from a proxy; only then trust X-Forwarded-For.
    TRUST_PROXY: bool = False

    # Enables demo reset and forces SMS dry run (decisions D9).
    DEMO_MODE: bool = False
    # ISO instant with offset; ignored in production (decisions D10).
    CROWN_CLOCK_OVERRIDE: str = ""

    CROWN_OWNER_EMAIL: str = ""
    CROWN_OWNER_PASSWORD: str = ""
    CROWN_OWNER_NAME: str = ""

    SMS_DRY_RUN: bool = False
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    CROWN_SHOP_SMS_TO: str = ""

    CROWN_CLOUDINARY_CLOUD_NAME: str = ""
    CROWN_CLOUDINARY_API_KEY: str = ""
    CROWN_CLOUDINARY_API_SECRET: str = ""
    MEDIA_DIR: str = str(BACKEND_DIR / "media")

    @property
    def cloudinary_enabled(self) -> bool:
        return bool(self.CROWN_CLOUDINARY_CLOUD_NAME and self.CROWN_CLOUDINARY_API_KEY
                    and self.CROWN_CLOUDINARY_API_SECRET)

    @property
    def sms_dry_run(self) -> bool:
        twilio_ready = self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN and self.TWILIO_FROM_NUMBER
        return self.SMS_DRY_RUN or self.DEMO_MODE or not twilio_ready


settings = Settings()
