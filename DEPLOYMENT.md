# 온라인 배포

## 현재 상태

배포용 코드와 테스트를 준비한 상태입니다. 저장소 업로드와 실제 서버 생성·DNS 설정·환경 변수 입력·배포 성공은 각각 별도 단계입니다. 샘플 주소로 실행했다고 실제 온라인 배포가 완료된 것은 아닙니다.

```text
브라우저 → Vercel 정적 화면 및 /api 프록시
                       ↓ HTTPS + GAME_ORIGIN_SECRET
              게임 API (단일 인스턴스)
              SQLite 영구 볼륨
                       ↓ HTTPS + 별도 GRADER_KEY
              채점 전용 Linux 서버
              Rootless Docker → 일회용 컨테이너
```

API 컨테이너에는 Docker CLI/소켓을 제공하지 않습니다. 채점 서버에는 게임 DB, 계정 자료, Vercel 비밀값을 복사하지 않습니다. 제출 코드와 테스트 입력만 일회용 컨테이너로 전달하고 정답 판정은 컨테이너 밖의 채점 서버에서 수행합니다.

## 초기 서버 구성 제안

소규모 시험 운영 기준으로 게임 API는 Linux 1GB RAM, 채점 서버는 별도 Linux 2GB RAM부터 검토할 수 있습니다. 부하 시험으로 수용 인원을 확정하기 전까지 성능 보장은 아닙니다. Ubuntu 24.04 LTS, Node.js 24, 채점 동시 실행 1개를 전제로 합니다.

예시 제공업체는 AWS Lightsail입니다. 공식 요금표의 퍼블릭 IPv4 Linux 1GB는 월 US$7, 2GB는 월 US$12로 기본 서버 두 대의 합계는 US$19입니다. 세금, 도메인, 스냅샷, 초과 트래픽, Vercel 요금은 별도이며 신청 화면에서 다시 확인해야 합니다. 서울 리전을 지원합니다.

- 가격: https://aws.amazon.com/lightsail/pricing/
- 리전: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html

서버와 도메인이 없다면 이 단계에서 비용과 제공업체를 확정해야 합니다. 이 저장소가 자동으로 유료 서버를 생성하지는 않습니다.

## 1. 저장소와 Vercel 프로젝트

Vercel에서 GitHub 저장소를 가져오고 프로젝트를 만듭니다. Framework Preset은 Other, Root Directory는 저장소 루트입니다. `vercel.json`의 빌드 명령을 사용하며 `.vercel/output` Build Output API로 화면과 API 프록시만 내보냅니다.

먼저 생성한 Vercel 프로젝트의 고정 주소를 기록하세요. 임의의 PR 미리보기 주소는 운영 API의 허용 출처에 자동 추가하지 않습니다. 초기 배포가 환경 변수 부족으로 실패해도 실제 API 서버 주소를 준비한 뒤 재배포하면 됩니다.

## 2. 채점 서버 준비

별도 서버에 일반 사용자 `grader`를 만들고 Node.js 24, rootless Docker, cgroup v2를 준비합니다. Docker 공식 rootless 설치 안내를 따르세요. Docker 소켓을 인터넷에 공개하거나 `--privileged` 컨테이너를 사용하지 않습니다.

https://docs.docker.com/engine/security/rootless/

`grader` 사용자로 저장소를 `~/security-shift`에 복제하고 다음을 확인합니다.

```bash
node --version
docker info
docker pull node:24-alpine
RUN_DOCKER_TESTS=1 node --test tests/docker.test.mjs
```

운영 이미지 버전을 고정하려면 검증한 이미지의 RepoDigest를 확인해 `GRADER_IMAGE`에 digest 주소를 지정하세요. 기본 샘플 태그는 `node:24-alpine`입니다.

서로 다른 비밀값 두 개를 `openssl rand -hex 32`로 생성합니다. 하나는 GAME_ORIGIN_SECRET, 다른 하나는 GRADER_KEY입니다. 결과를 GitHub나 채팅에 올리지 마세요. 예제 파일의 REPLACE 문자열은 실행 시 거부합니다.

`deploy/.env.grader.example`을 참고해 `~/.config/security-shift/grader.env`에 실제 GRADER_KEY를 넣고 파일 권한을 600으로 설정합니다. `GRADER_REQUIRE_ROOTLESS=1`을 유지합니다. 해당 키는 이후 게임 API에만 공유합니다.

`deploy/security-shift-grader.service`를 `~/.config/systemd/user/`에 복사하고:

```bash
systemctl --user daemon-reload
systemctl --user enable --now security-shift-grader
systemctl --user status security-shift-grader
```

재부팅 뒤 로그인 없이 실행하려면 관리자가 `sudo loginctl enable-linger grader`를 설정해야 합니다. Node의 설치 경로가 `/usr/bin/node`가 아니면 unit 파일의 ExecStart를 실제 경로로 바꾸세요.

채점 서버 DNS를 준비하고 `deploy/Caddyfile.grader`의 예제 도메인을 바꿔 Caddy로 HTTPS를 제공합니다. Node worker는 기본적으로 127.0.0.1:4100에만 바인딩합니다. 방화벽에서 4100을 외부에 열지 마세요. 가능하면 HTTPS 443도 API 서버 IP만 허용합니다. 인증 없는 `/healthz`도 401을 반환하는 것이 정상입니다.

## 3. 게임 API와 DB 준비

게임 서버에 Docker Engine과 Compose를 설치합니다. 이 서버의 Docker는 고정된 API·Caddy 서비스 운영용이며 플레이어 코드를 실행하지 않습니다.

`deploy/.env.backend.example`을 `deploy/.env.backend`로 복사하고 실제 값으로 채웁니다. 예제 주소·비밀값은 그대로 사용하지 마세요.

| 변수 | 값 |
|---|---|
| API_DOMAIN | 이 게임 서버를 가리키는 DNS 이름 |
| ACME_EMAIL | HTTPS 인증서 관리용 이메일 |
| PUBLIC_ORIGIN | 실제 Vercel 고정 HTTPS 주소 |
| GAME_ORIGIN_SECRET | Vercel과 공유할 첫 번째 비밀값 |
| GRADER_URL | 실제 HTTPS 채점 서버 주소, 경로 없이 origin만 |
| GRADER_KEY | 채점 서버와 공유할 두 번째 비밀값 |

저장소 루트에서:

```bash
docker compose --env-file deploy/.env.backend -f deploy/compose.api.yml config --quiet
docker compose --env-file deploy/.env.backend -f deploy/compose.api.yml up -d --build
docker compose --env-file deploy/.env.backend -f deploy/compose.api.yml ps
```

`/healthz`는 가벼운 DB 상태 확인을 위해 공개하지만 `/api/*`는 GAME_ORIGIN_SECRET 없는 직접 요청을 거부합니다. API 컨테이너의 SQLite는 `game-data` 영구 볼륨에 저장됩니다. `docker compose down -v`를 실행하면 DB 볼륨까지 삭제되므로 운영 갱신에는 사용하지 마세요.

## 4. Vercel 환경 변수와 배포

Vercel 프로젝트의 Production 환경 변수에 다음 두 값을 입력합니다.

| 변수 | 값 |
|---|---|
| GAME_API_ORIGIN | 실제 게임 API의 HTTPS origin |
| GAME_ORIGIN_SECRET | API와 동일한 첫 번째 비밀값 |

GRADER_KEY나 SQLite 경로는 Vercel에 입력하지 않습니다. 빌드는 실제 API 주소가 없으면 실패하도록 구성되어 있습니다. 비밀값은 정적 화면에 삽입하지 않고 내부 API rewrite의 요청 헤더에서만 참조합니다. 브라우저가 보낸 x-origin-secret 헤더는 프록시에서 교체합니다.

배포 뒤 확인:

1. Vercel 주소에서 회원가입·로그인하고 조 편성 확인
2. 공개 시각 전 문제 내용이 API 응답에 없는지 확인
3. 개념 문제 제출과 점수·조 점수 확인
4. 코드 문제 공개 후 정상 패치 제출, 실패 패치 제출, 결과 확인
5. 로그아웃 뒤 다시 로그인해 기록 유지 확인
6. API 컨테이너 재시작 후 계정·조·기록 유지 확인

원격 채점기만 별도로 검증하려면 신뢰할 수 있는 관리자 터미널에서 GRADER_URL과 GRADER_KEY를 설정한 뒤 `node scripts/check-grader.mjs`를 실행합니다. 준비 여부, 정상 코드, 거부 코드, 무한 반복 제한을 확인합니다.

## 검증 및 운영 범위

GitHub Actions는 Node 테스트와 실제 Docker 채점 검증을 실행합니다. Docker가 없는 로컬 환경에서는 Docker 전용 테스트 하나를 건너뛰며, 이것을 실제 컨테이너 검증 성공으로 간주하지 않습니다. CI의 Docker 테스트는 일반 Linux Docker에서의 검증이고 운영 rootless 서버에서는 같은 테스트를 다시 실행해야 합니다.

현재 SQLite와 제출 대기열은 단일 게임 API 인스턴스 기준입니다. 서버 재시작 중 채점하던 제출은 오류로 표시되고 다시 제출할 수 있습니다. 반복 인증 제한은 메모리 기반으로 재시작 시 초기화됩니다. 데이터 백업은 트래픽을 멈추고 API를 중지한 상태에서 SQLite 볼륨 전체를 암호화된 별도 저장소에 보관하거나 SQLite 온라인 백업 기능을 사용하세요.

현재 문제들은 공개 저장소의 샘플입니다. 실전 랭킹 이벤트에서 공개 전 비밀로 유지할 실제 문제는 이 공개 저장소에 커밋하지 말고, 별도 비공개 문제 저장·관리 기능을 추가한 후 운영해야 합니다.

## 공식 참고

- Vercel 외부 origin 프록시와 origin secret: https://vercel.com/docs/routing/rewrites
- Vercel Build Output API: https://vercel.com/docs/build-output-api/configuration
- Docker rootless: https://docs.docker.com/engine/security/rootless/
