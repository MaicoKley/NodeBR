// npm install hapi
// npm install vision inert hapi-swagger
// npm i hapi-auth-jwt2

// npm i bcrypt
const { config } = require('dotenv');
const { join } = require('path');
const { ok } = require('assert');

const env = process.env.NODE_ENV || "dev";
ok(env === "prod" || env === "dev", "a env é invalida, apenas dev ou prod");

const configPath = join(__dirname, '../configs', `.env.${env}`);
config({
    path: configPath
});

const Hapi = require('hapi');
const Context = require('./db/strategies/base/contextStrategy');
const MongoDb = require('./db/strategies/mongodb/mongodb');
const HeroiSchema = require('./db/strategies/mongodb/schemas/heroisSchema');
const HeroRoute = require('./routes/heroRoutes');
const AuthRoute = require('./routes/authRoutes');

const Postgres = require('./db/strategies/postgres/postgres');
const UsarioSchema = require('./db/strategies/postgres/schemas/userSchema');

const HapiSwagger = require('hapi-swagger');
const Vision = require('vision');
const Inert = require('inert');

const HapiJwt = require('hapi-auth-jwt2');
const JWT_SECRET = process.env.JWT_KEY;

const app = new Hapi.Server({
    port: process.env.PORT
});

function mapRoutes(instance, methods) {
    return methods.map(method => instance[method]());
}

async function main() {
    const connection = MongoDb.connect();
    const context = new Context(new MongoDb(connection, HeroiSchema));

    const connectionPostgres = await Postgres.connect();
    const model = await Postgres.defineModel(connectionPostgres, UsarioSchema);
    const contextPostgres = new Context(new Postgres(connectionPostgres, model));

    const swaggerOptions = {
        info: {
            title: 'API Herois - #CursoNodeBR',
            version: 'v1.0'
        },
        lang: 'pt'
    }
    await app.register([
        HapiJwt,
        Vision,
        Inert,
        {
            plugin: HapiSwagger,
            options: swaggerOptions
        }
    ]);

    app.auth.strategy('jwt', 'jwt', {
        key: JWT_SECRET,
        // options: {
        //      expiresIn: 20
        // },
        validate: async (dado, request) => {
            const [result] = await contextPostgres.read({
                username: dado.username.toLowerCase()
            })

            if (!result) {
                return {
                    isValid: false
                }
            }
            // verifica no banco se usuario continua ativo
            // verifica no banco se usuario continua pagando

            return {
                isValid: true //vaso não valido false
            }
        }
    })
    app.auth.default('jwt');

    app.route([
        ...mapRoutes(new HeroRoute(context), HeroRoute.methods()),
        ...mapRoutes(new AuthRoute(JWT_SECRET, contextPostgres), AuthRoute.methods())
    ])

    await app.start();
    console.log('Servidor rodando na porta', app.info.port);

    return app;
}

module.exports = main();