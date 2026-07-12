import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../entities/user.entity';
import { Supplier } from '../entities/supplier.entity';

type Priority = 'low' | 'normal' | 'high' | 'urgent';

type NotificationInput = {
  title: string;
  message: string;
  link?: string;
  referenceType?: string;
  referenceId?: string;
  priority?: Priority;
};

function getPrimaryRole(user?: { role?: string; roles?: Array<{ name?: string }> }) {
  if (user?.role) return user.role;
  if (!Array.isArray(user?.roles) || user.roles.length === 0) return 'staff';
  return String(user.roles[0]?.name || 'staff');
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
  ) {}

  async listForUser(user?: { id?: string; role?: string; roles?: Array<{ name?: string }> }) {
    const userId = String(user?.id || '').trim();
    const role = getPrimaryRole(user);

    const notifications = await this.notificationRepo.find({
      where: [
        userId ? { recipientUserId: userId } : undefined,
        role ? { recipientRole: role } : undefined,
      ].filter(Boolean) as Array<Partial<Notification>>,
      order: { createdAt: 'DESC' },
    });

    return notifications.map((notification) => this.serialize(notification));
  }

  async markRead(id: string, user?: { id?: string; role?: string; roles?: Array<{ name?: string }> }) {
    const notification = await this.findAccessibleNotification(id, user);
    notification.isUnread = false;
    notification.readAt = new Date();
    await this.notificationRepo.save(notification);
    return this.serialize(notification);
  }

  async markAllRead(user?: { id?: string; role?: string; roles?: Array<{ name?: string }> }) {
    const notifications = await this.listForUser(user);
    const ids = notifications.map((notification) => notification.id);
    if (ids.length === 0) return { updated: 0 };

    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isUnread: false, readAt: new Date() })
      .where('id IN (:...ids)', { ids })
      .execute();

    return { updated: ids.length };
  }

  async notifyUser(userId: string, input: NotificationInput) {
    const trimmedUserId = String(userId || '').trim();
    if (!trimmedUserId) return null;

    return this.notificationRepo.save(
      this.notificationRepo.create({
        recipientUserId: trimmedUserId,
        title: input.title,
        message: input.message,
        link: input.link,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        priority: input.priority || 'normal',
        isUnread: true,
      }),
    );
  }

  async notifyRole(role: string, input: NotificationInput) {
    const normalizedRole = String(role || '').trim();
    if (!normalizedRole) return [];

    const users = await this.userRepo.find({ relations: ['roles'] });
    const targets = users.filter((user) =>
      Array.isArray(user.roles) && user.roles.some((userRole) => String(userRole?.name || '').toLowerCase() === normalizedRole.toLowerCase()),
    );

    return Promise.all(targets.map((user) => this.notifyUser(user.id, input)));
  }

  async notifySupplier(supplierId: string, input: NotificationInput) {
    const supplier = await this.supplierRepo.findOne({
      where: { id: supplierId },
      relations: ['user'],
    });

    if (supplier?.user?.id) {
      return this.notifyUser(supplier.user.id, input);
    }

    return this.notifyRole('supplier', input);
  }

  private async findAccessibleNotification(id: string, user?: { id?: string; role?: string; roles?: Array<{ name?: string }> }) {
    const notification = await this.notificationRepo.findOne({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const userId = String(user?.id || '').trim();
    const role = getPrimaryRole(user);
    const canAccess =
      (userId && notification.recipientUserId === userId) ||
      (role && notification.recipientRole === role) ||
      (!notification.recipientUserId && !notification.recipientRole);

    if (!canAccess) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  private serialize(notification: Notification) {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      recipientUserId: notification.recipientUserId,
      recipientRole: notification.recipientRole,
      referenceType: notification.referenceType,
      referenceId: notification.referenceId,
      link: notification.link,
      priority: notification.priority,
      isUnread: notification.isUnread,
      createdAt: notification.createdAt?.toISOString(),
      readAt: notification.readAt?.toISOString(),
    };
  }
}
