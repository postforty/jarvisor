import os
from pathlib import Path
from typing import List, Optional

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from app.core.config import settings


class RAGService:
    """로컬 FAISS 기반 사내 인사규정(hr_regulations.pdf) 전용 인덱싱 및 유사도 검색 서비스"""

    def __init__(
        self,
        pdf_path: Optional[str] = None,
        storage_dir: Optional[str] = None,
        embeddings: Optional[Embeddings] = None,
    ):
        # 1. 인사규정 PDF 파일 경로 설정 (기본값: workspace/documents/hr_regulations.pdf)
        if pdf_path:
            self.pdf_path = Path(pdf_path)
        else:
            # apps/api/app/services 기준 5단계 상위 디렉토리가 모노레포 루트
            project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
            candidate_path = project_root / "workspace" / "documents" / "hr_regulations.pdf"
            if not candidate_path.exists():
                for alt in [
                    Path("workspace/documents/hr_regulations.pdf"),
                    Path("../workspace/documents/hr_regulations.pdf"),
                    Path("../../workspace/documents/hr_regulations.pdf"),
                ]:
                    if alt.exists():
                        candidate_path = alt.resolve()
                        break
            self.pdf_path = candidate_path

        # 2. FAISS 인덱스 로컬 캐시 디렉토리 설정
        if storage_dir:
            self.storage_dir = Path(storage_dir)
        else:
            api_root = Path(__file__).resolve().parent.parent.parent
            self.storage_dir = api_root / "storage" / "faiss_hr"

        # 3. 임베딩 모델 설정 (gemini-embedding-2)
        if embeddings:
            self.embeddings = embeddings
        else:
            api_key = (settings.GEMINI_API_KEY or "").strip()
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model=settings.EMBEDDING_MODEL,
                google_api_key=api_key or "DUMMY_KEY",
            )

        self._vectorstore: Optional[FAISS] = None

    def load_and_chunk_documents(self) -> List[Document]:
        """오직 hr_regulations.pdf 단일 PDF 문서만 파싱하여 조항 단위로 청킹"""
        raw_documents: List[Document] = []

        if not self.pdf_path.exists():
            print(f"[RAGService] 오류: 인사규정 PDF 파일을 찾을 수 없습니다: {self.pdf_path}")
            return raw_documents

        # PyPDFLoader를 통해 PDF 페이지만 전용 로드
        try:
            loader = PyPDFLoader(str(self.pdf_path))
            raw_documents.extend(loader.load())
        except Exception as e:
            print(f"[RAGService] PDF 파일 로드 실패: {e}")
            return []

        # 법률/규정 문서 특성을 고려한 조항(제N조) 및 표 맥락 보존 분할기
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=150,
            separators=["\n제", "\n\n", "\n", " "],
        )

        return text_splitter.split_documents(raw_documents)

    def build_index(self) -> FAISS:
        """PDF 문서를 청킹하여 로컬 FAISS 인덱스를 생성하고 디스크에 저장"""
        chunks = self.load_and_chunk_documents()
        if not chunks:
            raise FileNotFoundError(f"인덱싱할 PDF 문서를 로드하지 못했습니다: {self.pdf_path}")

        self.storage_dir.mkdir(parents=True, exist_ok=True)
        vectorstore = FAISS.from_documents(chunks, self.embeddings)
        vectorstore.save_local(str(self.storage_dir))
        self._vectorstore = vectorstore
        return vectorstore

    def get_vectorstore(self) -> FAISS:
        """저장된 FAISS 인덱스를 로드하거나 미존재 시 자동 빌드하여 반환"""
        if self._vectorstore is not None:
            return self._vectorstore

        index_file = self.storage_dir / "index.faiss"
        if index_file.exists():
            try:
                loaded = FAISS.load_local(
                    str(self.storage_dir),
                    self.embeddings,
                    allow_dangerous_deserialization=True,
                )
                # 빈 더미 캐시인지 검증
                sample_docs = loaded.similarity_search("인사규정", k=1)
                if sample_docs and "사내 인사규정 문서가 비어 있습니다" in sample_docs[0].page_content:
                    print("[RAGService] 이전 더미 캐시 감지, 정식 PDF로 재생성 진행")
                    return self.build_index()

                self._vectorstore = loaded
                return self._vectorstore
            except Exception as e:
                print(f"[RAGService] 로컬 인덱스 로드 실패, 재생성 진행: {e}")

        return self.build_index()

    def search(self, query: str, k: int = 3) -> List[Document]:
        """쿼리와 가장 유사한 k개의 규정 조항 문서 청크 검색"""
        vectorstore = self.get_vectorstore()
        return vectorstore.similarity_search(query, k=k)

    def search_formatted(self, query: str, k: int = 3) -> str:
        """LLM이 즉시 파싱 및 조항 번호를 인용할 수 있는 포맷팅된 검색 결과 반환"""
        docs = self.search(query, k=k)
        if not docs:
            return "일치하는 사내 규정 및 조항을 찾을 수 없습니다."

        formatted_chunks = []
        for i, doc in enumerate(docs, 1):
            source = doc.metadata.get("source", "hr_regulations.pdf")
            page = doc.metadata.get("page", 0) + 1  # 1-indexed 페이지
            formatted_chunks.append(
                f"[문서 검색 결과 #{i}] (출처: {source}, 페이지: {page}P)\n{doc.page_content.strip()}"
            )

        return "\n\n".join(formatted_chunks)


# 전역 RAGService 싱글톤 인스턴스 관리
_default_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """RAGService 전역 싱글톤 인스턴스 반환 함수"""
    global _default_rag_service
    if _default_rag_service is None:
        _default_rag_service = RAGService()
    return _default_rag_service
