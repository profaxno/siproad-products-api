# Usa una imagen base de Node.js
FROM node:18

# Define el directorio de trabajo en el contenedor
WORKDIR /app

# Copia package.json e instala dependencias
COPY package*.json ./
RUN npm install

# Copia todo el código de la app al contenedor
COPY . .

# Compila el código TypeScript
RUN npm run build

# Expone el puerto en el que corre NestJS (ajústalo si es diferente)
EXPOSE 80

# Comando para iniciar la aplicación
CMD ["npm", "run", "start:prod"]