import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    // 1. Authenticate user
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: dbClient.ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

    if (parentId !== 0) {
      parentFile = await dbClient.db.collection('files').findOne({
        _id: dbClient.ObjectId(parentId),
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
        userId: dbClient.ObjectId(userId),
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
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

    // Ensure directory exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const fileUuid = uuidv4();
    const localPath = path.join(folderPath, fileUuid);

    // Decode Base64
    const fileBuffer = Buffer.from(data, 'base64');

    // Save file
    fs.writeFileSync(localPath, fileBuffer);

    const newFile = {
      userId: dbClient.ObjectId(userId),
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
