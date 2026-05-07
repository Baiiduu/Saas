import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the profile of the authenticated user.
   * Password hash is never exposed.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        avatar: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update the authenticated user's profile fields.
   * Only the provided fields are changed.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Verify the user exists
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const data: any = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        avatar: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`User ${userId} profile updated`);
    return updated;
  }
}
