# 두 명이 함께 작업하는 방법

## 처음 한 번

소유자: 저장소 Settings → Collaborators → Add people에서 `kkukku06`을 검색해 정확한 계정을 확인한 후 초대합니다. 동기는 초대를 수락하고 저장소를 clone합니다.

각자 본인 GitHub 계정으로 인증합니다. 계정 비밀번호나 토큰을 서로 공유하지 않습니다.

## 작업할 때마다

Issues에서 작업과 담당자를 정하고, 변경 사항이 없는 상태에서 시작하세요.

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/login
```

`feat/login`은 예시이므로 실제 작업 이름으로 바꿉니다.

코드를 수정한 뒤 변경 내용을 확인하고 필요한 파일만 커밋합니다.

```sh
git status
git diff
git add 수정한파일경로
git commit -m "feat: 로그인 화면 추가"
git push -u origin feat/login
```

GitHub의 Compare & pull request에서 대상 브랜치를 main으로 선택합니다. 한 일과 확인 방법을 적고 상대에게 검토를 요청합니다. 관련 이슈가 있으면 본문에 `Closes #이슈번호`를 적습니다.

상대가 확인하면 Squash and merge로 합칩니다. 합친 작업 브랜치는 삭제해도 됩니다.

## 다른 사람의 작업 가져오기

진행 중인 변경을 먼저 커밋하고, 현재 작업 브랜치에서 실행합니다.

```sh
git fetch origin
git merge origin/main
```

충돌이 생기면 에디터에서 두 사람의 변경을 확인해 필요한 코드를 남깁니다. 충돌 표시를 없애고 실행을 확인한 뒤 다음을 실행합니다.

```sh
git add 해결한파일경로
git commit
git push
```

해결이 어렵다면 `git merge --abort`로 병합을 취소하고 함께 확인합니다. 공유 브랜치에 force push하지 않습니다.

## 저장소 소유자가 추가로 설정할 항목

- Settings → Collaborators: 동기 초대와 수락 확인
- Settings → Rules → Rulesets: main 대상 규칙에서 PR을 통한 변경, 승인 1명, 강제 push 및 브랜치 삭제 차단을 설정할 수 있습니다. 적용 가능한 기능은 GitHub 요금제와 저장소 설정에 따라 확인하세요.
- Settings → General → Pull Requests: Squash merging 및 병합 후 브랜치 자동 삭제를 사용하면 관리하기 편합니다.

## 비밀 정보

실제 .env 대신 키 이름만 담은 .env.example을 공유합니다. 공개 저장소에 이미 올라간 키는 파일 삭제만으로 해결되지 않으므로 해당 서비스에서 폐기하고 새 키를 발급합니다.
