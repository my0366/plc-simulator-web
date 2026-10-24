# PLC 래더 시뮬레이터

React + TypeScript + Vite로 빌드하며 GitHub Pages에 배포합니다.

## 비밀번호 설정

비밀번호의 SHA-256 해시를 환경변수 `VITE_PASSWORD_SHA256`으로 설정합니다. 로컬 개발에서는 Git에 포함되지 않는 `.env.local` 파일에 설정하고, GitHub Pages 배포에서는 저장소의 **Settings → Secrets and variables → Actions**에 같은 이름의 repository secret을 추가하세요.

해시는 로컬에서 다음 명령으로 만들 수 있습니다. `원하는비밀번호`를 실제 비밀번호로 바꾸세요.

```sh
printf %s '원하는비밀번호' | shasum -a 256 | awk '{print $1}'
```

처음 배포할 때 GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정하세요. 브랜치 폴더를 직접 배포하면 Vite/TypeScript 원본 파일을 빌드하지 않아 리소스 404가 발생합니다. 설정 후 `main` 브랜치에 푸시하면 GitHub Actions가 secret을 빌드에 주입해 Pages에 배포합니다. 비밀번호 변경 후 새 해시로 secret을 갱신하세요. 현재 브라우저 탭 세션 동안만 접근이 유지됩니다.

> GitHub Pages는 정적 호스팅이라 클라이언트 비밀번호 화면은 실제 보안 경계가 아닙니다. 번들에서 해시를 추출해 우회할 수 있으므로 민감한 콘텐츠를 보호해야 한다면 인증 기능이 있는 서버/호스팅을 사용하세요.

## 개발

```sh
npm install
npm run dev
```

`npm run build`는 TypeScript 타입 검사 후 Vite 프로덕션 빌드를 실행합니다. 타입 검사만 실행하려면 `npm run typecheck`를 사용하세요.
