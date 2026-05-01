import Bull from 'bull';
import fs from 'fs';
import imageThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

// -------------------------
// Queue
// -------------------------
const fileQueue = new Bull('fileQueue', {
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
});

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!userId) throw new Error('Missing userId');
  if (!fileId) throw new Error('Missing fileId');

  const file = await dbClient.db.collection('files').findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });

  if (!file) throw new Error('File not found');

  const sizes = [500, 250, 100];

  for (const size of sizes) {
    const thumb = await imageThumbnail(file.localPath, {
      width: size,
    });

    fs.writeFileSync(`${file.localPath}_${size}`, thumb);
  }
});
