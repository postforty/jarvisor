# 주식회사 코리아바이브 사내망 접근제어 및 인프라 장애 대응 절차서

* **문서번호**: KV-SEC-INFRA-2026-T88
* **버전**: v3.4.1
* **최종개정일**: 2026년 01월 01일
* **문서 등급**: 사내 한정 (Internal Confidential)
* **소관 부서**: 플랫폼보안옵스팀 (SecOps)

---

## 제1장 원격 사내망(KV-Net) 접속 체계

### 1. 전용 터널링 프로토콜 개요
코리아바이브의 모든 외부 접근은 상용 VPN(OpenVPN, WireGuard 등)을 일체 허용하지 않으며, 자체 개발한 세션 기반 터널링 프로토콜인 **KV-Tunnel v4**를 통해서만 인가된다.

* **기본 게이트웨이 엔드포인트**: `tunnel-gw.koreavibe.internal:9443` (TCP 443/8443 포트 사용 불가)
* **보조 우회 엔드포인트**: `failover-relay.koreavibe.internal:11443`
* **인증 암호화 방식**: `VIBE-CHACHA-POLY-1305` 기반 하드웨어 토큰 서명

### 2. 세션 인증 및 토큰 갱신 주기
1. 사내망 접속 세션의 최대 유효 시간은 **220분(3시간 40분)**이다. 220분이 경과하면 세션 경고 없이 즉각 단절되며, 백그라운드 프로세스는 자동 SIGKILL 처리된다.
2. 매 접속 시 2단계 인증(2FA)은 모바일 OTP 번호 6자리가 아닌, 사내 인증 앱에서 발행하는 **영문 대문자+특수문자 조합 9자리 난수 토큰**을 입력해야 한다.
3. 연속 3회 인증 실패 시 계정은 즉시 잠기며, 잠금 해제는 30분 대기가 아닌 **소속 팀장 및 SecOps 담당자 2인의 슬랙 이중 리액션 승인(`:kv-unlock:`, `:kv-verify:`)**이 있어야만 즉시 복구된다.

---

## 제2장 환경별 클라이언트 설정 및 오류 조치 절차

### 1. 운영체제(OS)별 접속 클라이언트 초기화

#### macOS 환경 (CLI 전용)
macOS 환경에서는 별도의 GUI 클라이언트를 제공하지 않으며, 사내 Homebrew 탭을 통해 CLI 바이너리를 직접 실행해야 한다.

```bash
# 1. 사내 프라이빗 탭 추가 및 클라이언트 설치
brew tap koreavibe/tap && brew install kv-cli-client@3.4

# 2. 로컬 라우팅 테이블 충돌 방지용 플래그 설정 (DNS는 10.240.0.53 고정)
kv-client init --set-dns 10.240.0.53 --route-mode strict-split --mtu 1380

# 3. 세션 시작 명령어 (반드시 백그라운드 데몬 모드로 실행)
kv-client connect --gateway 9443 --keep-alive 45s --daemon
```

#### Windows 환경 (WSL2 브릿지 우회)
Windows에서는 네이티브 윈도우 실행 파일이 차단되어 있으므로, **반드시 WSL2(Ubuntu 22.04 LTS) 내부에서 네트워크 브릿지 데몬을 통해 기동**해야 한다.

1. PowerShell을 관리자 권한으로 실행한 후 아래 명령을 통해 Hyper-V 가상 스위치 격리를 활성화한다.
   ```powershell
   Set-NetIPInterface -InterfaceAlias "vEthernet (WSL)" -InterfaceMetric 15 -Forwarding Enabled
   ```
2. WSL 내부 터미널로 진입하여 사내 데몬을 실행한다.
   ```bash
   sudo systemctl start kv-bridge-proxy.service
   kv-bridge-status --probe-latency
   ```
3. Latency 측정값이 **45ms 미만**일 때만 연결 버튼이 활성화되며, 45ms를 초과할 경우 접속이 강제 차단된다.

---

### 2. 고유 에러 코드(Error Code) 분석 및 조치 매뉴얼

| 에러 코드 | 발생 원인 | 일반적 원인과의 차이점 | 조치 순서 (Step-by-Step) |
| :--- | :--- | :--- | :--- |
| **`KV-ERR-7102`** | DNS 캐시 타임아웃이 아닌 **사내 로컬 호스트 변조 탐지** | 일반 네트워크 타임아웃 아님 | 1. `/etc/kv-hosts.deny` 파일 생성 여부 확인<br>2. `kv-client flush --force-registry` 실행<br>3. 로컬 단말 재부팅 1회 진행 |
| **`KV-ERR-8409`** | **단말 내부 화면 캡처 방지 데몬(KV-Guard) 비활성화** | 방화벽 차단 아님 | 1. 백그라운드 프로세스 `kv_screen_guard` 실행 여부 확인 (`pgrep kv_screen_guard`)<br>2. 미실행 시 `sudo kv-guard --enforce` 실행<br>3. 30초 대기 후 터널 재접속 |
| **`KV-ERR-9921`** | **동일 IP 대역 내 동시 접속 단말 수 초과** (사내 룰: 동일 공유기 내 최대 1대만 허용) | 계정 중복 로그인 아님 | 1. 동일 Wi-Fi 망 내 타 직원의 KV-Net 접속 여부 확인<br>2. 한쪽 단말을 모바일 테더링(LTE/5G)으로 전환<br>3. 단말 전환 후 3분 대기 후 재시도 |
| **`KV-ERR-3044`** | **클라이언트 시스템 시간 불일치 오차 허용치(7초) 초과** | 타임존 오류 아님 | 1. OS 시스템 시간 동기화 서버를 사내 NTP(`time.koreavibe.internal`)로 변경<br>2. `sudo sntp -sS time.koreavibe.internal` 실행 |

---

## 제3장 인프라 장애 발생 시 1차 대응 규정 (SOP)

### 1. 장애 등급(Severity) 분류 체계
일반적인 P1~P4 분류를 사용하지 않고, 서비스 영향 반경에 따라 **Amber(호박), Cobalt(코발트), Obsidian(흑요석)**의 3단계로 분류한다.

* **Obsidian (최상위 장애)**:
  * 결제 API 지연율 8% 이상 또는 코어 DB 커넥션 풀 가동률 92% 초과
  * 15분 이내 자동 복구 실패 시 비상대책본부(War Room) 즉시 소집
* **Cobalt (중간 장애)**:
  * 백오피스 서비스 응답 속도 4,500ms 초과 또는 내부 배치 작업 실패
  * 45분 이내 1차 조치 원칙
* **Amber (경미 장애)**:
  * 모니터링 메트릭 수집 누락 또는 사내 내부 툴 일시적 연결 지연

### 2. 장애 전파 및 커뮤니케이션 금지 규칙
1. **슬랙 채널 발송 금지**: 장애 상황 발생 시 전사 공지 채널(`@channel`, `@here`) 멘션은 **엄격히 금지**된다. 오직 비상 전용 채널인 `#ops-war-obsidian`에만 규정된 JSON 포맷으로 발송해야 한다.
2. **장애 통보 JSON 포맷**:
   ```json
   {
     "incident_level": "Cobalt",
     "affected_service": "kv-auth-cluster",
     "detected_epoch": 1767225600,
     "primary_responder": "홍길동",
     "rollback_ready": true
   }
   ```
3. 비인가 외부 메신저(카카오톡, 텔레그램 등)를 통한 인프라 이슈 공유 적발 시 보안 징계위원회가 소집된다.

### 3. 서비스 롤백(Rollback) 긴급 승인 권한
* **자동 롤백 임계치**: Canary 배포 시 에러율이 **1.8%**를 초과하여 3분간 지속될 경우 배포 파이프라인(ArgoCD Custom Plugin)이 자동으로 직전 2단계 릴리스 태그로 롤백한다.
* **수동 롤백 강제 집행 권한**: 엔지니어링 리드 단독 승인은 불가능하며, **온콜 엔지니어 1인 + 당직 프로덕트 매니저(PM) 1인의 동시 서명키(`kv-sign-token`) 교환**이 완료되어야 롤백 파이프라인 트리거가 해제된다.

---

## 제4장 데이터베이스 비상 조치 (Failover) 절차

### 1. Read Replica 강제 승격 조건
Primary DB 장애 시 AWS 콘솔을 통한 수동 장애 조치는 허용되지 않는다. 반드시 내부 CLI 툴(`kv-db-ctl`)을 사용해야 한다.

```bash
# 1. 클러스터 분기 상태 헬스체크 (Lag가 1,200ms 이하인 레플리카만 타겟 가능)
kv-db-ctl inspect --cluster prod-aurora-01 --check-lag

# 2. 강제 승격 트리거 실행 (토큰 승인 필요)
kv-db-ctl promote --target db-replica-03c --approval-token "AUTH-KV-9901-XZ"

# 3. 사내 DNS 레코드 TTL 강제 단축 (기본 300초 -> 10초로 임시 축소)
kv-dns-ctl set-ttl --record db-primary.internal --ttl 10
```

> **주의 사항**:
> 복제 지연(Replication Lag)이 **1,200ms(1.2초)**를 초과하는 복제본은 데이터 무결성 파괴 방지를 위해 승격 대상에서 영구 제외되며, 억지로 지정할 경우 `ERR_REPLICA_UNSAFE_LAG_THRESHOLD` 에러와 함께 CLI 프로세스가 종료된다.
