import { Controller, Get, HttpCode, HttpStatus, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get personal statistics for the current user' })
  @ApiResponse({
    status: 200,
    description: 'User stats returned successfully',
    schema: {
      type: 'object',
      properties: {
        totalTasks: { type: 'number', example: 42 },
        completionRate: { type: 'number', example: 65 },
        pendingCount: { type: 'number', example: 15 },
        overdueCount: { type: 'number', example: 3 },
      },
    },
  })
  async getUserStats(
    @CurrentUser('sub') userId: string,
  ) {
    return this.dashboardService.getUserStats(userId);
  }

  @Get('enterprise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get enterprise-level overview statistics' })
  @ApiResponse({
    status: 200,
    description: 'Enterprise overview returned',
    schema: {
      type: 'object',
      properties: {
        totalTasks: { type: 'number' },
        completionRate: { type: 'number' },
        overdueTasks: { type: 'number' },
        activeMembers: { type: 'number' },
        totalTeams: { type: 'number' },
        totalMilestones: { type: 'number' },
        milestoneCompletionRate: { type: 'number' },
      },
    },
  })
  async getEnterpriseOverview() {
    return this.dashboardService.getEnterpriseOverview();
  }

  @Get('team/:teamId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get team-level dashboard statistics' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({
    status: 200,
    description: 'Team stats returned',
  })
  async getTeamStats(@Param('teamId') teamId: string) {
    return this.dashboardService.getTeamStats(teamId);
  }

  // ── Export ───────────────────────────────────────────────────

  @Get('user/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export user dashboard stats as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportUserStats(
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.dashboardService.exportUserStatsCsv(userId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('enterprise/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export enterprise overview as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportEnterpriseOverview(@Res() res: Response) {
    const { csv, filename } = await this.dashboardService.exportEnterpriseOverviewCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('team/:teamId/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export team stats as CSV' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportTeamStats(
    @Param('teamId') teamId: string,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.dashboardService.exportTeamStatsCsv(teamId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
