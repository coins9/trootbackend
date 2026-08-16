import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase 환경변수 미설정 — 푸시 알림 비활성화');
      return;
    }

    if (admin.apps.length === 0) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Docker/CI 환경에서 \n 이스케이프 처리
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      this.app = admin.apps[0] ?? null;
    }

    this.logger.log('Firebase Admin SDK 초기화 완료');
  }

  async sendToToken(fcmToken: string, payload: PushPayload): Promise<void> {
    if (!this.app) return;
    try {
      await admin.messaging(this.app).send({
        token: fcmToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        android: { priority: 'high', notification: { sound: 'default' } },
      });
    } catch (err: unknown) {
      this.logger.warn(`[FCM] 발송 실패 token=${fcmToken.slice(0, 20)}…`, err);
    }
  }

  /** fcmToken이 null이면 무시 */
  async sendIfTokenExists(fcmToken: string | null, payload: PushPayload): Promise<void> {
    if (!fcmToken) return;
    await this.sendToToken(fcmToken, payload);
  }
}
