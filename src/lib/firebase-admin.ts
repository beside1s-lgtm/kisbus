import admin from 'firebase-admin';

// process.env.FIREBASE_SERVICE_ACCOUNT_KEY가 문자열화된 JSON이므로 파싱합니다.
// 환경 변수가 설정되지 않았을 경우를 대비하여 기본값으로 빈 객체 문자열을 제공합니다.
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}';
let serviceAccount;

try {
  serviceAccount = JSON.parse(serviceAccountString);
} catch (error) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it is a valid JSON string.', error);
  // 서비스 계정 키 파싱에 실패하면 초기화를 진행하지 않습니다.
  // 실제 운영 환경에서는 이 부분에 대한 로깅 및 알림이 중요합니다.
}


// admin 앱이 아직 초기화되지 않았고, 서비스 계정 정보가 유효할 경우에만 초기화를 시도합니다.
if (!admin.apps.length && serviceAccount && serviceAccount.project_id) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin SDK initialization failed:', error);
  }
}

export const authAdmin = admin.auth();
export const dbAdmin = admin.firestore();
