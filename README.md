# LoRA Platform UI

블랙과 화이트 모노톤 디자인의 LoRA 모델 공유 플랫폼 프론트엔드

![LoRA Platform Screenshot](./choan.png)
![LoRA Platform Screenshot](./choan2.png)

## 기술 스택

- **Vue 3** (Composition API) + TypeScript
- **Vue Router 4** - 클라이언트 사이드 라우팅
- **Vite** - 빌드 도구
- **CSS Variables** - 재사용 가능한 유틸리티 클래스 기반 스타일링
- **REST API** + **SSE** - 백엔드 통신
- **JWT** - 토큰 기반 인증

## 프로젝트 구조

```
src/
├── assets/
│   └── main.css              # 재사용 가능한 유틸리티 CSS 클래스 (모노톤)
├── components/
│   ├── Navigation.vue        # 네비게이션 바 (Google OAuth 인증 연동, 모바일 햄버거 메뉴)
│   └── ModelCard.vue         # 모델 카드 컴포넌트
├── views/
│   ├── ModelList.vue         # 모델 목록 (검색, 최신순/인기순, 태그 필터)
│   ├── ModelDetail.vue       # 모델 상세 (샘플, 프롬프트, 댓글)
│   ├── Generate.vue          # 이미지 생성 (SSE 실시간 진행률)
│   ├── Training.vue          # LoRA 학습 (SSE 실시간 진행률)
│   ├── Profile.vue           # 프로필/내 모델 (실시간 갱신)
│   ├── AuthCallback.vue      # OAuth2 콜백 처리
│   └── Login.vue             # 로그인 페이지
├── services/
│   └── api.ts                # REST API 클라이언트 + JWT 인증
├── router/
│   └── index.ts              # Vue Router 설정
├── App.vue                   # 루트 컴포넌트
└── main.ts                   # 엔트리 포인트
```

## API 엔드포인트

백엔드 API는 `http://localhost:8080`에서 실행되어야 합니다.

### 주요 API

- **인증**: `/api/auth/google`, `/api/auth/me`, `/api/auth/logout`
- **모델**: `/api/models`, `/api/models/{id}`, `/api/models/popular`
- **커뮤니티**: `/api/models/{id}/like`, `/api/models/{id}/favorite`, `/api/models/{id}/comments`
- **태그**: `/api/tags`, `/api/tags/popular`
- **사용자**: `/api/users/me`, `/api/users/{id}`
- **학습**: `/api/training/models/{id}`, `/api/training/jobs/{id}`
- **생성**: `/api/generate`, `/api/generate/history/my`
- **검색**: `/api/search`, `/api/search/models`

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

기본 포트: `http://localhost:5173`

### 3. 빌드

```bash
npm run build
```

## 주요 기능

### 🎨 모노톤 디자인
- 블랙(#000000)과 화이트(#ffffff) 기반
- 깔끔하고 세련된 UI/UX
- 다크 테마 기본 적용

### 🔐 인증
- Google OAuth 로그인
- JWT 토큰 기반 인증
- LocalStorage에 토큰 저장
- 자동 로그인 상태 체크

### 📱 반응형 디자인
- 모바일, 태블릿, 데스크톱 지원
- Flexbox 및 Grid 레이아웃
- 미디어 쿼리 기반 반응형 CSS

### 🎯 주요 페이지

#### 모델 탐색 (/)
- **통합 검색**: 제목, 설명, 캐릭터 이름으로 검색 (Enter 키 또는 Search 버튼)
- 최신/인기 모델 보기
- 태그로 필터링
- 페이지네이션
- 실시간 API 연동

#### 모델 상세 (/models/:id)
- 샘플 이미지 갤러리
- 프롬프트 예시
- 댓글 및 좋아요
- 다운로드 기능

#### 프로필 (/profile)
- 내 모델 관리
- 즐겨찾기 목록
- 생성 기록
- **프로필 수정**: 닉네임/이미지 변경 시 Navigation 바 자동 갱신 (새로고침 불필요)

#### 이미지 생성 (/generate)
- **2컬럼 레이아웃**: 왼쪽 설정 / 오른쪽 결과
- 완료된 내 LoRA 모델 선택
- 프롬프트 입력 (positive/negative)
- 파라미터 조절 (steps, guidance scale, seed)
- **SSE 실시간 진행률** (currentStep / totalSteps)
- 생성된 이미지 다운로드

#### 학습 (/training)
- **2컬럼 레이아웃**: 왼쪽 설정 / 오른쪽 히스토리
- **3단계 API 호출**:
  1. 모델 생성 (`createModel`)
  2. 트레이닝 작업 생성 (`createTrainingJob`)
  3. 트레이닝 시작 (`startTraining`)
- **설정**: title, description, characterName, style, trainingImagesCount, isPublic
- **하이퍼파라미터**: learningRate, epochs, loraRank, baseModel
- **SSE 실시간 진행률** (currentEpoch / totalEpochs, phase)
- **히스토리**: 내 트레이닝 작업 목록 (상태, 진행률, View Model/Delete)

## CSS 유틸리티 클래스

재사용 가능한 유틸리티 클래스를 `src/assets/main.css`에 정의:

### Layout
- `.container`, `.container-sm`
- `.flex`, `.flex-col`, `.grid`
- `.items-center`, `.justify-between`
- `.gap-{xs,sm,md,lg,xl}`

### Spacing
- `.p-{xs,sm,md,lg,xl}` - padding
- `.m-{xs,sm,md,lg,xl}` - margin
- `.px-*`, `.py-*`, `.mx-*`, `.my-*`

### Typography
- `.text-{xs,sm,base,lg,xl,2xl,3xl,4xl}`
- `.font-{normal,medium,semibold,bold}`
- `.text-{primary,secondary,muted,success,error}`

### Components
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`
- `.card`, `.card-sm`, `.card-clickable`
- `.input`, `.textarea`, `.label`
- `.badge`, `.tag`
- `.avatar`, `.avatar-sm`, `.avatar-lg`

### Utilities
- `.w-full`, `.h-full`
- `.rounded`, `.rounded-lg`, `.rounded-full`
- `.shadow`, `.shadow-md`, `.shadow-lg`
- `.loading`, `.skeleton`

## 환경 변수

`.env` 파일 생성 (옵션):

```env
VITE_API_URL=http://localhost:8080
VITE_FASTAPI_URL=http://127.0.0.1:8000
```

## API 클라이언트 사용법

```typescript
import { api, authStore } from '@/services/api';

// 모델 목록 가져오기
const response = await api.models.getPublicModels(0, 20);
console.log(response.data.content);

// 로그인 체크
if (authStore.isAuthenticated()) {
  const user = await api.user.getMyProfile();
}

// 모델 좋아요
await api.community.toggleLike(modelId);
```

## 인증 흐름

1. 사용자가 "Login with Google" 클릭 → `/api/auth/google` 호출
2. Spring Boot 백엔드가 Google OAuth2 페이지로 리다이렉트
3. 사용자가 Google에서 인증 완료
4. Google이 `/login/oauth2/code/google`로 콜백
5. 백엔드 `OAuth2SuccessHandler`가 JWT 토큰 생성
6. 프론트엔드 `/auth/callback`로 리다이렉트 (URL Fragment에 토큰 포함)
7. `AuthCallback.vue`가 Fragment에서 토큰 추출 후 LocalStorage에 저장
8. 홈(`/`)으로 리다이렉트 (페이지 새로고침으로 Navigation 상태 갱신)
9. 이후 모든 API 요청에 `Authorization: Bearer {token}` 헤더 자동 포함

## 개발 노트

### 📋 개발 히스토리

자세한 개발 과정과 트러블슈팅은 [claude.md](./claude.md) 참고

#### Phase 1: 기본 구조
- OpenAPI 스펙 분석 (json.json)
- 모노톤 블랙/화이트 디자인 시스템 (main.css)
- 기본 컴포넌트 및 페이지 생성

#### Phase 2: API 연동
- api.ts 전체 REST API 클라이언트 작성
- JWT 인증 구현 (authStore)
- 모든 뷰에 실제 API 호출 연동

#### Phase 3: 라우팅
- vue-router 설치 및 설정
- RouterView 적용
- 모든 링크를 router-link로 변경

#### Phase 4: Generate & Training 재작성
- Generate.vue: 2컬럼 레이아웃, SSE 진행률
- Training.vue: OpenAPI 스펙 정확히 준수, 3단계 API 호출, SSE 진행률

#### Phase 5: Google OAuth & UI 개선 ✅
- **Google OAuth 통합**: AuthCallback.vue, URL Fragment 토큰 전달
- **Navigation 개선**: 로그인 상태 표시, 모바일 햄버거 메뉴
- **프로필 자동 갱신**: CustomEvent로 Navigation 실시간 업데이트
- **Search 통합**: Explore 페이지에 검색 기능 추가
- **모바일 UX**: Create → Generate 버튼 변경, Search 탭 제거

### 🔧 CORS 설정
백엔드에서 CORS를 허용해야 합니다:
- Origin: `http://localhost:5173`
- Methods: `GET, POST, PUT, DELETE`
- Headers: `Content-Type, Authorization`

### 🚀 FastAPI 연동
이미지 생성 및 학습은 별도의 FastAPI 서버(`http://127.0.0.1:8000`)를 사용합니다.

### 📡 SSE (Server-Sent Events)
실시간 진행률 업데이트를 위해 SSE를 사용:
- `/api/training/stream` - 학습 진행률
- `/api/generate/stream` - 생성 진행률

### 🎨 모노톤 디자인
- 블랙(`#000000`)과 화이트(`#ffffff`)만 사용
- CSS 변수로 일관된 컬러 관리
- 재사용 가능한 유틸리티 클래스 기반
