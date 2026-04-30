import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({
      _id: ObjectId(userId),
    });

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let parentFile = null;

    if (parentId !== 0 && parentId !== '0') {
      try {
        parentFile = await dbClient.db.collection('files').findOne({
          _id: ObjectId(parentId),
        });
      } catch (e) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

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

    const folderPath =
      process.env.FOLDER_PATH && process.env.FOLDER_PATH.length > 0
        ? process.env.FOLDER_PATH
        : '/tmp/files_manager';

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const fileUuid = uuidv4();
    const localPath = path.join(folderPath, fileUuid);

    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

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

  static async getShow(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;

    if (!ObjectId.isValid(fileId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId =
      req.query.parentId !== undefined ? req.query.parentId : 0;

    const page = req.query.page ? parseInt(req.query.page, 10) : 0;

    const matchQuery = {
      userId: ObjectId(userId),
      parentId,
    };

    const files = await dbClient.db.collection('files')
      .aggregate([
        { $match: matchQuery },
        { $skip: page * 20 },
        { $limit: 20 },
      ])
      .toArray();

    return res.status(200).json(
      files.map((file) => ({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      }))
    );
  }
}

export default FilesController;
