import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ResourceService } from './resource.service';
import { CreateRepoDto } from './dto/create-repo.dto';
import { LinkResourceDto } from './dto/link-resource.dto';

@ApiTags('Resource')
@ApiBearerAuth('access-token')
@Controller('resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  // ── Repos ───────────────────────────────────────────────────

  @Post('repos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register an external repo (Git / S3)' })
  @ApiBody({ type: CreateRepoDto })
  @ApiResponse({ status: 201, description: 'Repo created successfully' })
  async createRepo(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRepoDto,
  ) {
    return this.resourceService.createRepo(user.sub, dto);
  }

  @Get('repos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List repos for a team' })
  @ApiQuery({ name: 'teamId', required: true, description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'List of repos returned' })
  async findReposByTeam(@Query('teamId') teamId: string) {
    return this.resourceService.findReposByTeam(teamId);
  }

  @Get('repos/:id/browse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Browse items inside a repo (directory listing)' })
  @ApiParam({ name: 'id', description: 'Repo ID' })
  @ApiQuery({ name: 'path', required: false, description: 'Directory path to browse' })
  @ApiResponse({ status: 200, description: 'Items returned' })
  @ApiResponse({ status: 404, description: 'Repo not found' })
  async browseRepo(
    @Param('id') id: string,
    @Query('path') path?: string,
  ) {
    return this.resourceService.browseRepo(id, path);
  }

  // ── Links ───────────────────────────────────────────────────

  @Post('links')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a resource item to a task or document' })
  @ApiBody({ type: LinkResourceDto })
  @ApiResponse({ status: 201, description: 'Link created successfully' })
  @ApiResponse({ status: 404, description: 'Resource item not found' })
  async linkResource(
    @CurrentUser() user: JwtPayload,
    @Body() dto: LinkResourceDto,
  ) {
    return this.resourceService.linkResource(user.sub, dto);
  }
}
