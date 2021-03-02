const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const express = require('express');

const router = express.Router();

const authConfig = require('../../config/auth.json');
const mailer = require('../../modules/mailer');
const User = require('../models/user');

function generateToken(params = {}) {
    return jwt.sign(params, authConfig.secret, {
        expiresIn: 86400,
    });
}

// Rota de Registro de novo usuário
router.post('/register', async (req, res) => {
    const { email } = req.body;
    try {
        if (await User.findOne({ email })) {
            return res.status(400).send({ error: 'User already exists' });
        }

        const user = await User.create(req.body);

        user.password = undefined;

        return res.send({
            user,
            token: generateToken({ id: user.id }),
        });
    }
    catch (err) {
        return res.status(400).send({ error: 'Resgistration failed: (' + err + ').' });
    }

});

// Rota de autenticação
router.post('/authenticate', async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user)
        return res.status(400).send({ error: 'User not found' });

    if (!await bcrypt.compare(password, user.password))
        return res.status(400).send({ error: 'Invalid password' });

    user.password = undefined;

    res.send({
        user,
        token: generateToken({ id: user.id }),
    });
});

// Rota de Esqueci minha senha
router.post('/forgot_password', async (req, res) => {
    const { email } = req.body;

    try {
        // busca usuário na base
        const user = await User.findOne({ email });

        // se usuário não encontrado, lança erro
        if (!user)
            return res.status(400).send({ error: 'User not found' });

        // token para nova senha
        const token = crypto.randomBytes(20).toString('hex');

        // expiração para o token de nova senha
        const now = new Date();
        now.setHours(now.getHours() + 1);

        // Salva token e expiração no usuário
        await User.findByIdAndUpdate(user, {
            $set: {
                passwordResetToken: token,
                passwordResetExpires: now,
            }
        });

        // envia e-mail com o token de reset de senha
        mailer.sendMail({
            to: email,
            from: 'raoniguimao@gmail.com',
            template: 'auth/forgot_password',
            context: { token },
        }, (err) => {
            // se algum erro no envio de e-mail ocorrer, lança erro
            if (err)
                return res.status(400).send({ error: "Cannot send forgot password e-mail.", 'erro': err });

            // lança Ok
            return res.send();
        });
    }
    catch (err) {
        return res.status(400).send({ error: "Error on forgot password. Please try again.\n" + err });
    }
});

// Rota de Reset de senha
router.post('/reset_password', async (req, res) => {
    const { email, token, password } = req.body;

    try {
        // busca usuário na base
        const user = await User.findOne({ email })
            .select('+passwordResetToken passwordResetExpires');

        // se usuário não encontrado, lança erro
        if (!user)
            return res.status(400).send({ error: 'User not found' });

        // se token enviado for diferente do guardado, lança erro
        if (token != user.passwordResetToken)
            return res.status(400).send({ error: 'Token invalid' });

        // se data atual for maior que a expiração programada, lança erro
        const now = new Date();
        if (now >= user.passwordResetExpires)
            return res.status(400).send({ error: 'Token expired, generate a new one.' });

        // grava nova senha e limpa passwordReset(s)
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        // salva usuário
        await user.save();

        // retorna OK
        return res.send();
    }
    catch (err) {
        return res.status(400).send({ error: "Error on reset password. Please try again later.\n" + err });
    }
})

module.exports = app => app.use('/auth', router);