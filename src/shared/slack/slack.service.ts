import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly webhookReport: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.webhookReport = this.config.get<string>('slack.webhookReport');
    if (!this.webhookReport) {
      this.logger.warn('SLACK_WEBHOOK_REPORT 미설정 — 신고 알림 비활성화');
    }
  }

  /** 신고 접수 알림 — 실패해도 메인 플로우를 막지 않는다 */
  sendReport(payload: {
    reporterDisplay: string;
    targetDisplay: string;
    reason: string;
    targetType: string;
    detail?: string | null;
    sanctioned: boolean;
  }): void {
    if (!this.webhookReport) return;
    const { reporterDisplay, targetDisplay, reason, targetType, detail, sanctioned } = payload;

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚨 새 신고 접수 — ${reason}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*신고자*\n${reporterDisplay}` },
          { type: 'mrkdwn', text: `*피신고자*\n${targetDisplay}` },
          { type: 'mrkdwn', text: `*카테고리*\n${targetType}` },
          { type: 'mrkdwn', text: `*사유*\n${reason}` },
        ],
      },
    ];

    if (detail) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*상세 내용*\n${detail}` },
      });
    }

    if (sanctioned) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '⚠️ *자동 제재 적용됨* — 피신고 계정이 즉시 정지되었습니다.' },
      });
    }

    blocks.push({ type: 'divider' });

    void this.post(this.webhookReport, { blocks });
  }

  private async post(url: string, body: object): Promise<void> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.warn(`Slack webhook 실패: ${res.status} ${await res.text()}`);
      }
    } catch (e) {
      this.logger.warn('Slack 전송 오류', e as Error);
    }
  }
}
