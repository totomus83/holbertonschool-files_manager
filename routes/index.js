import { Router } from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';

const routes = (app) => {

router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

router.post('/users', UsersController.postNew);

app.get('/connect', AuthController.getConnect);
app.get('/disconnect', AuthController.getDisconnect);
app.get('/users/me', UsersController.getMe);
};

export default router;
