/** Chat bells only. `type: "message"` also covers non-chat rows; those stay unless the href is a thread. */
export const messageNoticeWhere = {
  type: "message",
  href: { startsWith: "/messages/" },
} as const;

type Batch = { count: number };

export type ChatTables = {
  message: { deleteMany: () => Promise<Batch> };
  messageThread: { deleteMany: () => Promise<Batch> };
  notification: { deleteMany: (args: { where: typeof messageNoticeWhere }) => Promise<Batch> };
};

/** Messages first so the count is not zeroed by the thread cascade. */
export async function clearChats(db: ChatTables) {
  const messages = await db.message.deleteMany();
  const threads = await db.messageThread.deleteMany();
  await db.notification.deleteMany({ where: messageNoticeWhere });
  return { messages: messages.count, threads: threads.count };
}
