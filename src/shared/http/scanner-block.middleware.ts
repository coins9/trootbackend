import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * 자동 스캐너 봇이 노출된 시크릿/취약점을 찾을 때 흔히 때리는 경로.
 * 정상 API 는 전부 /api/v1/* 이고 health 만 예외이므로 아래 패턴과 절대 겹치지 않는다.
 * - 매칭되면 로그 한 줄 없이 즉시 404 로 끊어 로그 비용·CPU 를 아끼고
 *   스캐너에 어떤 정보도 주지 않는다(존재/부재 구분 불가).
 */
const PROBE_PATH = new RegExp(
  '(^|/)(' +
    '\\.git|\\.env|\\.aws|\\.ssh|\\.svn|\\.hg|\\.bzr|' +
    '\\.DS_Store|\\.vscode|\\.idea|' +
    'id_rsa|id_dsa|' +
    'wp-admin|wp-login\\.php|xmlrpc\\.php|wp-content|wp-includes|' +
    'phpmyadmin|phpunit|eval-stdin\\.php|' +
    'vendor/phpunit|' +
    'dump\\.sql|backup\\.sql|database\\.sql|' +
    'server-status|' +
    'HNAP1|boaform|' +
    'aws/credentials|s3cfg' +
  ')(/|$|\\.)',
  'i',
);

@Injectable()
export class ScannerBlockMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (PROBE_PATH.test(req.path)) {
      res.status(404).end();
      return;
    }
    next();
  }
}
