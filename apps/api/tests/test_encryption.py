import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select, text
from app.main import app
from app.models.session import Session as ChatSession, Message
from app.core.encryption import encrypt_text, decrypt_text, EncryptedString
from tests.conftest import test_engine


def test_encrypt_and_decrypt_text():
    """단위 테스트: 텍스트 암호화 및 복호화 기본 동작 검증"""
    original_text = "보스님, 극비 작전 코드명은 MK-85입니다."
    
    # 암호화 수행
    encrypted = encrypt_text(original_text)
    assert encrypted != original_text
    assert len(encrypted) > len(original_text)
    
    # 복호화 수행
    decrypted = decrypt_text(encrypted)
    assert decrypted == original_text


def test_decrypt_legacy_plaintext_backward_compatibility():
    """단위 테스트: 기존 DB에 평문으로 저장되어 있던 텍스트는 복호화 시 평문 그대로 반환 (하위 호환성)"""
    legacy_plain = "대한민국의 수도는?"
    result = decrypt_text(legacy_plain)
    assert result == legacy_plain


@pytest.mark.asyncio
async def test_message_content_encrypted_in_db_but_decrypted_on_access():
    """통합 테스트: Message 저장 시 DB에는 암호문으로 저장되고, ORM 접근 및 API 호출 시 평문으로 자동 복호화되는지 검증"""
    test_content = "1급 기밀 보안 메시지입니다."
    session_id = "SES-TEST-ENC"
    msg_id = "MSG-TEST-ENC-01"

    with Session(test_engine) as db:
        # 세션 및 메시지 생성
        chat_sess = ChatSession(id=session_id, title="보안 테스트 세션")
        db.add(chat_sess)
        
        msg = Message(
            id=msg_id,
            session_id=session_id,
            role="user",
            content=test_content,
        )
        db.add(msg)
        db.commit()

    # 1. Raw SQL 쿼리로 DB 실제 저장 데이터 확인 (평문이 아닌 암호문이어야 함)
    with Session(test_engine) as db:
        raw_result = db.exec(text("SELECT content FROM message WHERE id = :msg_id").bindparams(msg_id=msg_id)).one()
        raw_content = raw_result[0]
        # DB에는 평문이 그대로 노출되지 않아야 함
        assert raw_content != test_content
        # 복호화하면 원래 내용이어야 함
        assert decrypt_text(raw_content) == test_content

    # 2. ORM(SQLModel)으로 조회 시 자동으로 복호화되어 평문으로 반환되어야 함
    with Session(test_engine) as db:
        fetched_msg = db.get(Message, msg_id)
        assert fetched_msg is not None
        assert fetched_msg.content == test_content

    # 3. GET /api/v1/sessions/{session_id} 엔드포인트 호출 시 평문으로 응답되는지 검증
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]) >= 1
        assert data["messages"][0]["content"] == test_content
