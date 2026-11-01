from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

from app.core.encryption import EncryptedString


def get_utc_now() -> datetime:
    """현재 UTC 시간 반환 (타임존 포함)"""
    return datetime.now(timezone.utc)


class Session(SQLModel, table=True):
    """대화 세션 테이블 스키마"""
    id: str = Field(default=None, primary_key=True)
    title: str = Field(default="새로운 작전 회의")
    summary: Optional[str] = Field(default=None)
    model_name: str = Field(default="gemini-3.1-flash-lite")
    is_pinned: bool = Field(default=False)
    is_archived: bool = Field(default=False)
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    # 메시지 관계 매핑
    messages: List["Message"] = Relationship(back_populates="session", cascade_delete=True)


class Message(SQLModel, table=True):
    """세션 내 메시지 테이블 스키마"""
    id: str = Field(default=None, primary_key=True)
    session_id: str = Field(foreign_key="session.id", index=True)
    role: str = Field(...)  # 'user' | 'assistant' | 'system'
    content: str = Field(..., sa_type=EncryptedString)
    model_name: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=get_utc_now)

    # 세션 관계 매핑
    session: Optional[Session] = Relationship(back_populates="messages")
