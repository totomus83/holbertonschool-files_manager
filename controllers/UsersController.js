import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Missing email
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    // Missing password
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const db = dbClient.db;

    // Check if user exists
    const userExists = await db.collection('users').findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'Already exist' });
    }

    // Hash password
    const hashedPassword = sha1(password);

    // Insert user
    const result = await db.collection('users').insertOne({
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      id: result.insertedId,
      email,
    });
  }
}

export default UsersController;
