import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/guards';
import { GENRES, REGIONS } from '../regions';

/**
 * 지역·장르 표준 코드를 앱에 내려준다.
 * 앱은 하드코딩 대신 이 목록을 받아 써서, 지역 추가 시 앱 재배포가 필요 없다.
 */
@Controller('public/meta')
@Public()
export class MetaController {
  @Get('regions')
  @Header('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  regions() {
    return REGIONS;
  }

  @Get('genres')
  @Header('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  genres() {
    return GENRES;
  }
}
