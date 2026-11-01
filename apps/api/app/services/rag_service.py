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


def _resolve_document_path(filename: str) -> Path:
    """모노레포 루트 및 상대 경로를 순회하여 workspace/documents 내 대상 문서 경로 탐색"""
    project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    candidate = project_root / "workspace" / "documents" / filename
    if not candidate.exists():
        for alt in [
            Path("workspace/documents") / filename,
            Path("../workspace/documents") / filename,
            Path("../../workspace/documents") / filename,
        ]:
            if alt.exists():
                return alt.resolve()
    return candidate


class RAGService:
    """로컬 FAISS 기반 직무별(인사 규정, 인프라 보안 SOP 등) 인덱싱 및 유사도 검색 서비스"""

    def __init__(
        self,
        pdf_path: Optional[str] = None,
        storage_dir: Optional[str] = None,
        embeddings: Optional[Embeddings] = None,
        domain_label: str = "사내 규정",
    ):
        self.domain_label = domain_label

        # 1. 대상 PDF 파일 경로 설정
        if pdf_path:
            self.pdf_path = Path(pdf_path)
        else:
            self.pdf_path = _resolve_document_path("hr_regulations.pdf")

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
        """대상 단일 PDF 문서만 파싱하여 조항 및 절차 단위로 청킹"""
        raw_documents: List[Document] = []

        if not self.pdf_path.exists():
            print(f"[RAGService] 오류: 문서 PDF 파일을 찾을 수 없습니다: {self.pdf_path}")
            return raw_documents

        # PyPDFLoader를 통해 PDF 페이지만 전용 로드
        try:
            loader = PyPDFLoader(str(self.pdf_path))
            raw_documents.extend(loader.load())
        except Exception as e:
            print(f"[RAGService] PDF 파일 로드 실패: {e}")
            return []

        # 규정 조항(제N조) 및 SOP 절차(###, ##, 절, 항) 맥락 보존 분할기
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=150,
            separators=["\n제", "\n### ", "\n## ", "\n# ", "\n\n", "\n", " "],
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
                sample_docs = loaded.similarity_search("규정 절차", k=1)
                if sample_docs and "문서가 비어 있습니다" in sample_docs[0].page_content:
                    print(f"[RAGService] 이전 더미 캐시 감지, 정식 PDF({self.pdf_path.name})로 재생성 진행")
                    return self.build_index()

                self._vectorstore = loaded
                return self._vectorstore
            except Exception as e:
                print(f"[RAGService] 로컬 인덱스 로드 실패, 재생성 진행: {e}")

        return self.build_index()

    def search(self, query: str, k: int = 3) -> List[Document]:
        """쿼리와 가장 유사한 k개의 규정/절차 조항 문서 청크 검색"""
        vectorstore = self.get_vectorstore()
        return vectorstore.similarity_search(query, k=k)

    def search_formatted(self, query: str, k: int = 3) -> str:
        """LLM이 즉시 파싱 및 조항 번호를 인용할 수 있는 포맷팅된 검색 결과 반환"""
        docs = self.search(query, k=k)
        if not docs:
            return f"일치하는 {self.domain_label} 조항 및 절차를 찾을 수 없습니다."

        formatted_chunks = []
        for i, doc in enumerate(docs, 1):
            source = Path(doc.metadata.get("source", self.pdf_path.name)).name
            page = doc.metadata.get("page", 0) + 1  # 1-indexed 페이지
            formatted_chunks.append(
                f"[문서 검색 결과 #{i}] ({self.domain_label} | 출처: {source}, 페이지: {page}P)\n{doc.page_content.strip()}"
            )

        return "\n\n".join(formatted_chunks)


# 도메인별 RAGService 싱글톤 인스턴스 레지스트리
_rag_services: dict[str, RAGService] = {}


def get_rag_service(domain: str = "hr") -> RAGService:
    """도메인별(hr, secops 등) RAGService 싱글톤 인스턴스 반환 팩토리 함수"""
    global _rag_services
    domain_key = domain.lower().strip()

    if domain_key not in _rag_services:
        api_root = Path(__file__).resolve().parent.parent.parent
        if domain_key == "secops":
            secops_pdf = _resolve_document_path("secops_infra_sop.pdf")
            secops_storage = api_root / "storage" / "faiss_secops"
            _rag_services[domain_key] = RAGService(
                pdf_path=str(secops_pdf),
                storage_dir=str(secops_storage),
                domain_label="인프라 및 보안 절차서",
            )
        else:  # 기본값 "hr"
            hr_pdf = _resolve_document_path("hr_regulations.pdf")
            hr_storage = api_root / "storage" / "faiss_hr"
            _rag_services[domain_key] = RAGService(
                pdf_path=str(hr_pdf),
                storage_dir=str(hr_storage),
                domain_label="사내 인사 규정",
            )

    return _rag_services[domain_key]
