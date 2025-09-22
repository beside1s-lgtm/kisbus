
import admin from 'firebase-admin';

// 환경 변수가 설정되지 않았는지 확인
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY 환경 변수가 설정되지 않았습니다. API 라우트가 정상적으로 동작하지 않을 수 있습니다.');
}

// admin 앱이 아직 초기화되지 않은 경우에만 초기화 시도
if (!admin.apps.length) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountString) {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin SDK가 성공적으로 초기화되었습니다.');
    } catch (error: any) {
      console.error('❌ Firebase Admin SDK 초기화 실패: 서비스 계정 키(JSON) 파싱 중 오류가 발생했습니다.', error.message);
    }
  }
}

export const authAdmin = admin.apps.length ? admin.auth() : null;
export const dbAdmin = admin.apps.length ? admin.firestore() : null;
