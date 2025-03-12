# # Usa una imagen base de Node.js
# FROM node:18

# # Define el directorio de trabajo en el contenedor
# WORKDIR /app

# # Copia package.json e instala dependencias
# COPY package*.json ./
# RUN npm prune --production

# # Copia todo el código de la app al contenedor
# COPY . .

# # Compila el código TypeScript
# RUN npm run build

# # Expone el puerto en el que corre NestJS (ajústalo si es diferente)
# EXPOSE 80

# # Comando para iniciar la aplicación
# CMD ["npm", "run", "start:prod"]


# Etapa 1: Construcción de la aplicación
FROM node:18-alpine AS builder

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos necesarios
COPY package.json package-lock.json ./

# Instala solo las dependencias necesarias para construir la app
RUN npm install --omit=dev

# Copia el resto del código fuente
COPY . .

# Compila TypeScript
RUN npm run build

# Etapa 2: Imagen final para producción
FROM node:18-alpine

WORKDIR /app

# Copia solo los archivos necesarios desde la etapa de construcción
COPY --from=builder /app/package.json /app/package-lock.json /app/.env ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expone el puerto en el que corre la app
EXPOSE 80

# Comando para iniciar la aplicación
# CMD ["node", "dist/main.js"]
CMD ["npm", "run", "start:prod"]