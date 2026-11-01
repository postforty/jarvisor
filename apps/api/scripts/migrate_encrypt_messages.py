import shutil
from pathlib import Path
from sqlmodel import Session, create_engine, text
from app.core.config import settings
from app.core.encryption import encrypt_text, get_fernet


def migrate_existing_messages():
    """기존 DB(jarvisor.db) 내의 평문 메시지 내용을 Fernet 암호화 형식으로 일괄 변환 마이그레이션"""
    db_file = Path("jarvisor.db")
    if not db_file.exists():
        print(f"[!] 데이터베이스 파일({db_file})을 찾을 수 없습니다.")
        return

    # 1. 안전을 위한 백업 생성
    backup_file = Path("jarvisor.db.bak")
    shutil.copyfile(db_file, backup_file)
    print(f"[+] 백업 완료: {backup_file}")

    engine = create_engine(settings.DATABASE_URL)
    fernet = get_fernet()

    migrated_count = 0
    already_encrypted_count = 0

    with Session(engine) as session:
        rows = session.exec(text("SELECT id, content FROM message")).all()
        print(f"[i] 전체 검사 대상 메시지: {len(rows)}건")

        for msg_id, content in rows:
            if not content:
                continue

            # 이미 정상 암호화된 토큰인지 확인
            is_encrypted = False
            try:
                fernet.decrypt(content.encode("utf-8"))
                is_encrypted = True
            except Exception:
                is_encrypted = False

            if is_encrypted:
                already_encrypted_count += 1
            else:
                # 평문인 경우 암호화 수행 및 업데이트
                cipher_text = encrypt_text(content)
                session.exec(
                    text("UPDATE message SET content = :encrypted_content WHERE id = :id"),
                    params={"encrypted_content": cipher_text, "id": msg_id},
                )
                migrated_count += 1

        session.commit()

    print(f"[+] 마이그레이션 성공: {migrated_count}건 암호화 완료, {already_encrypted_count}건 기암호화 유지")


if __name__ == "__main__":
    migrate_existing_messages()
