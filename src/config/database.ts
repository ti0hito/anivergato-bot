import mongoose from 'mongoose';
import dns from 'node:dns';

/**
 * Conecta ao MongoDB Atlas configurando DNS resiliente contra falhas de SRV no Windows
 */
export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('A variável MONGODB_URI não foi informada no arquivo .env');
    }

    mongoose.connection.on('connected', () => {
      console.log('📦 [MongoDB] Conectado com sucesso ao banco de dados!');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ [MongoDB] Erro de conexão:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ [MongoDB] Conexão com MongoDB desconectada.');
    });

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });

    return mongoose;
  } catch (error: any) {
    console.error('❌ [MongoDB] Falha crítica na conexão:', error.message);
    throw error;
  }
}

