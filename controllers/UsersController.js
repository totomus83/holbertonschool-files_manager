import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import db from '../utils/db';
import redis from '../utils/redis';

const UsersController = {
  postNew: async (req, res) => {
    // Récupération de l'email et du pwd
    const { email, password } = req.body;

    // Vérification de l'email et du pwd
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    // Vérifie que l'email n'existe pas déjà dans la DB
    const emailExists = await db.client.db(db.database).collection('users').findOne({ email });
    if (emailExists) {
      return res.status(400).json({ error: 'Already exist' });
    }

    // Hashage du pwd
    const hashedPwd = crypto.createHash('sha1').update(password).digest('hex');

    const newId = await db.client.db(db.database).collection('users').insertOne({ email, password: hashedPwd });
    return res.status(201).json({ id: newId.insertedId, email });
  },

  getMe: async (req, res) => {
    // Récupération du header X-Token
    const xTokenHeader = req.headers['x-token'];
    const key = `auth_${xTokenHeader}`;

    const userId = await redis.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await db.client.db(db.database).collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ email: user.email, id: user._id });
  },
};

export default UsersController;
