import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    // 1. Authenticate user
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({
      _id: ObjectId(userId),
    });

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // 2. Extract body
    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = req.body;

    // 3. Validate inputs
    if (!name) return res.status(400).json({ error: 'Missing name' });

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // 4. Validate parent
    let parentFile = null;

    if (parentId !== 0 && parentId !== '0') {
      parentFile = await dbClient.db.collection('files').findOne({
        _id: ObjectId(parentId),
      });

      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // 5. Folder case
    if (type === 'folder') {
      const newFolder = {
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
      };

      const result = await dbClient.db.collection('files').insertOne(newFolder);

      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    // 6. File/Image case
    const folderPath =
      process.env.FOLDER_PATH && process.env.FOLDER_PATH.length > 0
        ? process.env.FOLDER_PATH
        : '/tmp/files_manager';

    // Ensure directory exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const fileUuid = uuidv4();
    const localPath = path.join(folderPath, fileUuid);

    // Decode Base64 safely
    const fileBuffer = Buffer.from(data, 'base64');

    fs.writeFileSync(localPath, fileBuffer);

    const newFile = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId,
      localPath,
    };

    const result = await dbClient.db.collection('files').insertOne(newFile);

    return res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }
}

export default FilesController;
