# SESSION_HANDOVER (2026-04-08)

## 📌 Current Status (현재 상태)
- **Expo 서버 정상화 완료**: Node.js 24 버전과 Windows 절대 경로(한글 포함)의 ESM 로더 충돌 이슈(`ERR_UNSUPPORTED_ESM_URL_SCHEME: Received protocol 'c:'`)를 해결했습니다.
- **Node.js 버전 최적화**: NVM을 사용하여 시스템에 Node 20.20.2(LTS)를 설치하고 터미널 세션의 PATH를 고정하여 호환성을 확보했습니다.
- **설정 파일 최적화**: `metro.config.js`를 `.cjs` 확장자로 전환하여 Node 로더의 버그를 우회하고 Metro 번들러를 성공적으로 기동했습니다.

## 🛠️ Modified Files (수정된 주요 파일)
- `kisbus-mobile/metro.config.cjs`: NativeWind 4 및 Expo 설정을 포함한 최신 Metro 설정 파일 (CommonJS 방식).
- `kisbus-mobile/metro.config.js`: ESM 로더 에러 방지를 위해 삭제되었습니다. (다시 생성하지 않도록 주의 필요)
- `kisbus-mobile/.env.local`: Firebase API 키 등 필요한 환경 변수가 설정되어 있습니다.

## 🚀 Next Steps (다음 작업 목표)
1. **모바일 UI 구현**: NativeWind를 활용하여 `app/(tabs)` 폴더 내의 페이지 레이아웃을 작성합니다.
2. **Firebase 연동**: 웹 프로젝트(`src/`)와 동일한 Firebase 프로젝트를 모바일에서도 사용하여 실시간 데이터 동기화를 구현합니다.
3. **버스 위치 추적 및 알림**: 버스 기사님 전용 페이지(모바일)에서 실시간 위치(GPS)를 전송하고, 학생/학부모 앱에서 이를 지도에 표시하는 기능을 구현합니다.

## 💡 Important Context (핵심 컨텍스트)
- **경로 이슈**: 현재 프로젝트 경로(`C:\Users\KOREAN\OneDrive\바탕 화면\kisbus`)에 한글('바탕 화면')과 공백이 포함되어 있어 Node.js 최신 버전에서 경로 해석 오류가 잦습니다. 
- **설정 규칙**: Expo 관련 설정 파일 수정 시 반드시 `.cjs` 확장자를 사용해야 하며, 에러가 재발할 경우 `nvm use 20` 명령어로 노드 버전을 다시 확인해야 합니다.
- **NativeWind**: v4를 사용 중이며, `global.css` 파일을 통해 테마를 관리하고 있습니다.
