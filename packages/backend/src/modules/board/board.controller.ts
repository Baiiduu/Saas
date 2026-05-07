import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BoardService } from './board.service';
import { UpdateColumnDto } from './dto/update-column.dto';

@ApiTags('Board')
@ApiBearerAuth('access-token')
@Controller('teams/:teamId/board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  // ── Board ──────────────────────────────────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get kanban board data (columns with grouped tasks)' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Board data returned' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getBoard(@Param('teamId') teamId: string) {
    return this.boardService.getBoard(teamId);
  }

  // ── Gantt Chart ─────────────────────────────────────────────

  @Get('gantt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Gantt chart data (tasks with dates and dependencies)' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Gantt chart data returned' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getGantt(@Param('teamId') teamId: string) {
    return this.boardService.getGanttData(teamId);
  }

  // ── Calendar View ───────────────────────────────────────────

  @Get('calendar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get calendar view data (tasks grouped by due date)' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Calendar data returned' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getCalendar(@Param('teamId') teamId: string) {
    return this.boardService.getCalendarData(teamId);
  }

  // ── Column Configuration ───────────────────────────────────

  @Patch('columns')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patch board column configuration (add/update/delete/reorder)' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiBody({ type: UpdateColumnDto })
  @ApiResponse({ status: 200, description: 'Columns updated' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async updateColumns(
    @Param('teamId') teamId: string,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.boardService.updateColumnConfig(teamId, dto);
  }
}
