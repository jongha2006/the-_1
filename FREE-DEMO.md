# 카드 등록 없는 최소 무료 데모

이 버전의 기본 시험 경로는 **Render Free 웹서비스 한 개**입니다. 게임 화면·API·SQLite·JavaScript 함수 채점을 같은 서비스에 묶습니다. 별도 VPS, 도메인 구매, 유료 DB, Docker 데몬이 필요하지 않습니다. Render 계정 로그인과 무료 서비스 배포 승인은 사용자가 해야 합니다.

## 바로 배포

[Render 무료 데모 만들기](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fjongha2006%2Fthe-_1%2Ftree%2Ffeat%2Fsecurity-shift-deployment)

1. 위 링크에서 Render에 무료 가입/로그인합니다.
2. Blueprint 내용을 확인합니다. **Web Service 1개, Free 플랜**이어야 합니다.
3. 배포를 승인하고 빌드가 끝나면 생성된 `https://….onrender.com` 주소를 엽니다.
4. 닉네임과 비밀번호로 가입한 뒤 다른 브라우저에서도 별도 계정을 만들어 조·점수 공유를 확인합니다.
5. 문제는 즉시/30초/60초에 공개됩니다. 정상 코드 패치를 제출해 점수와 순위를 확인합니다.

자동 배포는 꺼 두었습니다. 저장소 변경 사항을 반영하려면 Render에서 수동 재배포합니다. 현재 작업 브랜치의 `render.yaml`을 사용하므로 main 병합 전에도 시험할 수 있습니다.

## 이 데모에서 달라진 것

- 서버 시작 즉시 25분 라운드를 열고, 끝나면 다음 방문 시 새 라운드를 시작합니다.
- 조는 라운드 시작 1분 뒤 확정하고 미션은 30초 간격으로 공개합니다.
- 코드 채점은 QuickJS WebAssembly 엔진에서 실행합니다. Node의 eval/vm으로 사용자 코드를 실행하지 않습니다.
- 호스트 파일·process·require·fetch·DB 접근 기능을 엔진에 제공하지 않습니다. 엔진 메모리 8MB, 실행 인터럽트 500ms, 별도 worker thread의 강제 종료 5초, 출력 32KB 제한을 둡니다. 테스트 정답 판정은 엔진 밖에서 합니다.
- 현재 지원 범위는 제공된 JavaScript 함수 하나의 수정입니다. Python, 임의 프로젝트 실행, 패키지 설치, 실제 OS 명령 실행은 지원하지 않습니다.
- SQLite는 `/tmp/security-shift/game.sqlite`에 저장합니다. 서버가 살아 있는 동안 참가자들이 같은 DB를 공유합니다.
- 15분 무접속 시 절전되며 다시 접속할 때 약 1분이 걸릴 수 있습니다. **절전·재시작·재배포 시 계정·점수·조 기록이 초기화될 수 있습니다.** 화면에도 표시합니다.
- Render Free는 매월 무료 사용 한도가 있습니다. 카드 등 결제 수단을 등록하지 않은 상태에서 한도에 도달하면 추가 과금 대신 서비스나 빌드가 중단될 수 있습니다. 데모용 계정에 불필요하게 결제 수단을 추가하지 마세요.

이 구성은 작동 검증용이며 기록 보존과 매일 정해진 시각의 가용성을 보장하는 운영 서버는 아닙니다.

## 직접 서비스 생성할 때

Blueprint 대신 New → Web Service → Public Git Repository에서 다음을 지정해도 됩니다.

| 항목 | 값 |
|---|---|
| 저장소 | `https://github.com/jongha2006/the-_1` |
| 브랜치 | `feat/security-shift-deployment` |
| Runtime / Plan | Node / Free |
| Build Command | `npm ci --ignore-scripts` |
| Start Command | `node server.mjs --demo` |
| Health Check | `/healthz` |

환경 변수는 `render.yaml`과 동일하게 설정합니다. PUBLIC_ORIGIN은 Render가 제공하는 RENDER_EXTERNAL_URL에서 자동으로 읽습니다. 공개 URL을 임의로 입력하거나 API 키를 넣을 필요가 없습니다. Render가 설정하는 PORT를 사용하고 HOST는 0.0.0.0입니다.

## 로컬 실행

Node.js 24와 npm에서 `npm ci --ignore-scripts`를 먼저 실행합니다. PowerShell 예시:

```powershell
$env:GRADER_MODE='wasm'
$env:DEMO_DEPLOYMENT='1'
$env:DEMO_FAST='1'
node server.mjs --demo
```

이 설정은 로컬 개발용입니다. NODE_ENV=production으로 직접 실행할 때는 HTTPS PUBLIC_ORIGIN과 절대 경로의 SECURITY_GAME_DB도 필요합니다.

## Vercel은 어떻게 연결하나

Render 주소만으로 전체 게임을 시험할 수 있습니다. Vercel 화면도 사용하려면 기존 배포 파일을 이용합니다.

1. Render에 무작위 GAME_ORIGIN_SECRET과 실제 Vercel 고정 주소의 PUBLIC_ORIGIN을 설정합니다.
2. Vercel에 GAME_API_ORIGIN=Render HTTPS 주소와 동일한 GAME_ORIGIN_SECRET을 설정합니다.
3. Vercel을 재배포합니다. 이후 로그인과 게임은 Vercel 주소에서 진행합니다.

Vercel로 연결한 뒤에도 무료 Render 서버의 절전·기록 초기화 조건은 그대로입니다. 지금은 이 추가 연결 없이 Render 주소에서 먼저 검증하는 것이 가장 간단합니다.

## 공식 근거

- 카드 없이 무료 시험 배포: https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026
- 무료 한도·절전·SQLite 초기화: https://render.com/docs/free
- 배포 버튼과 작업 브랜치: https://render.com/docs/deploy-to-render
- QuickJS 엔진과 자원 제한: https://github.com/justjake/quickjs-emscripten

별도 서버와 Docker 방식은 추후 필요할 때 [DEPLOYMENT.md](DEPLOYMENT.md)를 사용합니다. 유료 서버 생성은 이 무료 데모에 필요하지 않습니다.
