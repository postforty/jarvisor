import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet
from sqlalchemy.types import TypeDecorator, Text

from app.core.config import settings


def _get_encryption_key() -> bytes:
    """설정된 환경변수 또는 결정론적 파생 키로부터 Fernet 32바이트 urlsafe base64 키 반환"""
    raw_key = getattr(settings, "CHAT_ENCRYPTION_KEY", "")
    if raw_key and len(raw_key.strip()) > 0:
        clean_key = raw_key.strip().encode("utf-8")
        # 32바이트 urlsafe base64 키인지 직접 검증 시도
        try:
            Fernet(clean_key)
            return clean_key
        except Exception:
            # 전달된 키 문자열을 SHA-256 해시하여 32바이트 base64 키로 파생
            digest = hashlib.sha256(clean_key).digest()
            return base64.urlsafe_b64encode(digest)

    # 기본 개발/테스트 환경용 결정론적 폴백 키 생성
    default_salt = b"jarvisor-chat-encryption-default-salt-v1"
    digest = hashlib.sha256(default_salt).digest()
    return base64.urlsafe_b64encode(digest)


_cached_fernet: Optional[Fernet] = None


def get_fernet() -> Fernet:
    """Fernet 암호화 인스턴스 싱글톤 반환"""
    global _cached_fernet
    if _cached_fernet is None:
        key = _get_encryption_key()
        _cached_fernet = Fernet(key)
    return _cached_fernet


def encrypt_text(plain_text: Optional[str]) -> Optional[str]:
    """평문 텍스트를 Fernet 대칭키로 암호화하여 문자열 토큰으로 반환"""
    if plain_text is None or plain_text == "":
        return plain_text
    fernet = get_fernet()
    encrypted_bytes = fernet.encrypt(plain_text.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")


def decrypt_text(cipher_text: Optional[str]) -> Optional[str]:
    """암호화된 문자열을 복호화. 복호화 실패 시(이전 평문 데이터 등) 원본 텍스트 반환하여 하위 호환성 보장"""
    if cipher_text is None or cipher_text == "":
        return cipher_text
    fernet = get_fernet()
    try:
        decrypted_bytes = fernet.decrypt(cipher_text.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception:
        # 기존 평문 데이터이거나 다른 키로 작성된 경우 원본 반환
        return cipher_text


class EncryptedString(TypeDecorator):
    """SQLAlchemy/SQLModel 전용 대화 내용 암호화 TypeDecorator.
    DB 저장 시 암호화, DB 조회 시 평문으로 자동 복호화됩니다.
    """
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_text(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return decrypt_text(value)
