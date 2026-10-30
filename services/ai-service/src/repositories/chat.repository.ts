import { db } from '../../../../packages/database/src/index.js';

export class ChatRepository {
  static async createSession(userId: string) {
    return db.chatSession.create({ data: { userId } });
  }

  static async getSessionsByUser(userId: string) {
    return db.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  static async getSessionById(id: string, userId: string) {
    return db.chatSession.findFirst({
      where: { id, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });
  }

  static async addMessage(sessionId: string, role: string, content: string, tokens?: number) {
    // Touch the session updatedAt
    await db.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() }
    });

    return db.chatMessage.create({
      data: { sessionId, role, content, tokens }
    });
  }

  static async getRecentMessages(sessionId: string, limit: number = 10) {
    return db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit
    }).then((msgs: any[]) => msgs.reverse()); // Return in chronological order
  }

  static async deleteSession(id: string, userId: string) {
    const session = await db.chatSession.findFirst({
      where: { id, userId }
    });
    if (!session) return null;

    return db.$transaction(async (tx: any) => {
      await tx.chatMessage.deleteMany({
        where: { sessionId: id }
      });
      return tx.chatSession.delete({
        where: { id }
      });
    });
  }

  static async deleteAllSessions(userId: string) {
    return db.$transaction(async (tx: any) => {
      const userSessions = await tx.chatSession.findMany({
        where: { userId },
        select: { id: true }
      });
      const sessionIds = userSessions.map((s: any) => s.id);
      if (sessionIds.length > 0) {
        await tx.chatMessage.deleteMany({
          where: { sessionId: { in: sessionIds } }
        });
        const deleteResult = await tx.chatSession.deleteMany({
          where: { userId }
        });
        return { count: deleteResult.count };
      }
      return { count: 0 };
    });
  }
}

